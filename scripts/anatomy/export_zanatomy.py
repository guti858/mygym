"""
Exporta el modelo anatómico del atlas Z-Anatomy al formato compacto de MyGym.

Fuente: Z-Anatomy (https://www.z-anatomy.com), CC BY-SA 4.0, derivado de BodyParts3D
(The Database Center for Life Science, CC BY-SA 2.1 Japan). El fichero generado
(src/anatomy/data.generated.ts) es una obra derivada y se distribuye con la misma licencia.

Qué hace:
  1. Abre Startup.blend con Blender como módulo de Python (bpy), sin ejecutar sus scripts.
  2. Selecciona los músculos superficiales, tendones, huesos visibles y la piel de cabeza,
     manos y pies (lado izquierdo + estructuras de línea media; el lado derecho se refleja
     en tiempo de ejecución).
  3. Reduce cada malla a una densidad de triángulos uniforme (Decimate) y la pasa a los ejes
     del motor (X izquierda, Y arriba, Z anterior).
  4. Calcula los pesos de cada vértice respecto a los huesos del rig del motor por proximidad
     a la superficie ósea, los suaviza sobre la malla y los reparte entre los huesos auxiliares
     de articulación (medio giro) para conservar el volumen.
  5. Mide los centros articulares en reposo (cadera, rodilla, tobillo, hombro, codo, muñeca,
     dedos...) y lo escribe todo como un módulo TypeScript (manifiesto JSON + binario base64).

Uso:
  python -I scripts/anatomy/export_zanatomy.py <Startup.blend> <salida.ts>
"""

import base64
import json
import math
import sys

import bpy  # noqa: E402  (bmesh solo existe tras importar bpy)
import bmesh  # noqa: E402
import numpy as np
from mathutils import Matrix
from mathutils.kdtree import KDTree

BLEND, OUT = sys.argv[-2], sys.argv[-1]
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=BLEND, load_ui=False, use_scripts=False)

# ---------------------------------------------------------------------------------------------
# Selección
# ---------------------------------------------------------------------------------------------

MUSCLE_GROUPS = {
    'pectoral_clavicular': ['Clavicular head of pectoralis major muscle'],
    'pectoral_esternal': ['Sternocostal head of pectoralis major muscle', '(Abdominal part of pectoralis major muscle)'],
    'deltoides_anterior': ['Clavicular part of deltoid muscle'],
    'deltoides_lateral': ['Acromial part of deltoid muscle'],
    'deltoides_posterior': ['Scapular spinal part of deltoid muscle'],
    'biceps': ['Long head of biceps brachii', 'Short head of biceps brachii'],
    'braquial': ['Brachialis muscle', 'Brachioradialis muscle'],
    'triceps': ['Long head of triceps brachii', 'Lateral head of triceps brachii', 'Medial head of triceps brachii'],
    'antebrazo': [
        'Flexor carpi radialis', 'Palmaris longus muscle', 'Humeral head of flexor carpi ulnaris',
        'Ulnar head of flexor carpi ulnaris', 'Humero-ulnar head of flexor digitorum superficialis',
        'Radial head of flexor digitorum superficialis', 'Superficial head of pronator teres',
    ],
    'dorsal_ancho': ['Latissimus dorsi muscle'],
    'redondo_mayor': ['Teres major muscle'],
    # En Z-Anatomy las etiquetas «ascending/descending» del trapecio están intercambiadas:
    # se asignan por geometría (la porción cervical es la superior).
    'trapecio_superior': ['Ascending part of trapezius muscle'],
    'trapecio_medio': ['Transverse part of trapezius muscle', 'Rhomboid major muscle', 'Rhomboid minor muscle'],
    'trapecio_inferior': ['Descending part of trapezius muscle'],
    'serrato': ['Serratus anterior muscle'],
    'erectores': ['Iliocostalis lumborum muscle', 'Iliocostalis thoracis muscle', 'Longissimus thoracis muscle', 'Spinalis thoracis muscle'],
    'abdominales': ['Rectus abdominis muscle', 'External abdominal oblique muscle'],
    'gluteo_mayor': ['Gluteus maximus muscle'],
    'gluteo_medio': ['Gluteus medius muscle'],
    'cuadriceps': ['Rectus femoris muscle', 'Vastus lateralis muscle', 'Vastus medialis muscle'],
    'isquiotibiales': ['Long head of biceps femoris', 'Short head of biceps femoris', 'Semitendinosus muscle', 'Semimembranosus muscle'],
    'aductores': ['Adductor magnus', 'Adductor longus', 'Adductor brevis', 'Gracilis muscle', 'Pectineus muscle'],
    'gastrocnemio': ['Lateral head of gastrocnemius', 'Medial head of gastrocnemius'],
    'soleo': ['Soleus muscle'],
}

OTHER_MUSCLES = [
    'Sternocleidomastoid muscle', 'Levator scapulae', 'Splenius capitis muscle', 'Sternohyoid muscle',
    'Infraspinatus muscle', 'Teres minor muscle', 'Supraspinatus muscle', 'Coracobrachialis muscle',
    'Anconeus muscle', 'Extensor carpi radialis longus', 'Extensor carpi radialis brevis', 'Extensor digitorum',
    'Extensor digiti minimi', 'Humeral head of extensor carpi ulnaris', 'Ulnar head of extensor carpi ulnaris',
    'Abductor pollicis longus', 'Extensor pollicis brevis', 'Extensor pollicis longus',
    'Tensor fasciae latae', 'Sartorius muscle', 'Iliacus muscle', 'Psoas major',
    'Tibialis anterior muscle', 'Extensor digitorum longus', 'Extensor hallucis longus',
    'Fibularis longus muscle', 'Fibularis brevis muscle', 'Flexor digitorum longus',
]

TENDONS = ['Calcaneal tendon', 'Iliotibial tract', 'Linea alba']

BONES_RENDER = [
    'Clavicle', 'Scapula', 'Humerus', 'Radius', 'Ulna', 'Hip bone', 'Sacrum', 'Femur', 'Patella', 'Tibia', 'Fibula',
    'Manubrium of sternum', 'Body of sternum', 'Xiphoid process',
] + [f'{n} rib' for n in ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth']] + [
    f'Costal cartilage of {n} rib' for n in ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
]

FINGERS = {'i': 'second', 'm': 'third', 'r': 'fourth', 'p': 'fifth'}
PHALANX = ['Proximal', 'Middle', 'Distal']

HEAD_EXCLUDE = {
    'Lateral region of neck', 'Posterior region of neck', 'Sternocleidomastoid region', 'Carotid triangle',
    'Muscular triangle', 'Greater supraclavicular fossa', 'Lesser supraclavicular fossa',
    'Eyebrow', 'Eyelashes', 'Hairs of eyebrow', 'Hairs of head', 'Pubic hairs',
}
HAND_REGIONS = ['Dorsum of hand', 'Palm', 'Dorsal surfaces of digits of hand', 'Palmar surfaces of digits of hand',
                'Nail plate', 'Perionyx', 'Anterior region of wrist', 'Posterior region of wrist', 'Radial foveola']
FOOT_REGIONS = ['Dorsum of foot', 'Sole', 'Heel region', 'Dorsal surfaces of digits of foot', 'Plantar surfaces of digits of foot',
                'Nail plate (foot)', 'Perionyx (foot)', 'Lateral border of foot', 'Medial border of foot',
                'Lateral part of longitudinal arch of foot', 'Medial part of longitudinal arch of foot',
                'Distal transverse arch of foot', 'Proximal transverse arch of foot', 'Hallucial eminence', 'Metatarsal region',
                'Anterior region of ankle', 'Lateral malleolus', 'Medial malleolus', 'Lateral retromalleolar region',
                'Medial retromalleolar region']

# ---------------------------------------------------------------------------------------------
# Rig (debe coincidir con src/anatomy/rig.ts)
# ---------------------------------------------------------------------------------------------

AXIAL = ['pelvis', 'lumbar', 'thorax', 'neck']
AXIAL_HELPERS = ['h_s1', 'h_l1', 'h_c7']
SIDED = ['girdle', 'humerus', 'fa0', 'fa1', 'fa2', 'fa3', 'hand',
         'i1', 'i2', 'i3', 'm1', 'm2', 'm3', 'r1', 'r2', 'r3', 'p1', 'p2', 'p3', 't1', 't2',
         'thigh', 'shank', 'foot']
SIDED_HELPERS = ['h_sc', 'h_gh', 'h_th', 'h_el', 'h_wr', 'h_hip', 'h_kn', 'h_an']
BONES = AXIAL + AXIAL_HELPERS + [f'{b}.L' for b in SIDED + SIDED_HELPERS] + [f'{b}.R' for b in SIDED + SIDED_HELPERS]
BI = {b: i for i, b in enumerate(BONES)}
HELPER_PAIRS = {
    ('pelvis', 'lumbar'): 'h_s1', ('lumbar', 'thorax'): 'h_l1', ('thorax', 'neck'): 'h_c7',
    ('thorax', 'girdle.L'): 'h_sc.L', ('girdle.L', 'humerus.L'): 'h_gh.L', ('thorax', 'humerus.L'): 'h_th.L',
    ('humerus.L', 'fa0.L'): 'h_el.L', ('fa3.L', 'hand.L'): 'h_wr.L', ('pelvis', 'thigh.L'): 'h_hip.L',
    ('thigh.L', 'shank.L'): 'h_kn.L', ('shank.L', 'foot.L'): 'h_an.L',
}

# Huesos de anclaje (por proximidad) de cada hueso del rig.
ANCHORS = {
    'pelvis': ['Hip bone', 'Sacrum', 'Coccyx'],
    'lumbar': [f'Vertebra L{i}' for i in range(1, 6)],
    'thorax': [f'Vertebra T{i}' for i in range(1, 13)] + BONES_RENDER[11:],
    'neck': ['Atlas (C1)', 'Axis (C2)'] + [f'Vertebra C{i}' for i in range(3, 8)] + [
        'Frontal bone', 'Parietal bone', 'Occipital bone', 'Temporal bone', 'Sphenoid bone', 'Zygomatic bone',
        'Maxilla', 'Mandible', 'Hyoid bone', 'Nasal bone', 'Thyroid cartilage', 'Cricoid cartilage'],
    'girdle.L': ['Clavicle', 'Scapula'],
    'humerus.L': ['Humerus'],
    'forearm.L': ['Radius', 'Ulna'],
    'hand.L': ['Scaphoid bone', 'Lunate bone', 'Triquetrum bone', 'Pisiform bone', 'Trapezium bone', 'Trapezoid bone',
               'Capitate bone', 'Hamate bone'] + [f'{n} metacarpal bone' for n in ['First', 'Second', 'Third', 'Fourth', 'Fifth']],
    't1.L': ['Proximal phalanx of first finger of hand'],
    't2.L': ['Distal phalanx of first finger of hand'],
    'thigh.L': ['Femur'],
    'h_kn.L': ['Patella'],
    'shank.L': ['Tibia', 'Fibula'],
    'foot.L': ['Talus', 'Calcaneus', 'Navicular bone', 'Cuboid bone', 'Medial cuneiform bone', 'Intermediate cuneiform bone',
               'Lateral cuneiform bone', 'Sesamoid bones of foot'] + [f'{n} metatarsal bone' for n in ['First', 'Second', 'Third', 'Fourth', 'Fifth']]
              + [f'{p} phalanx of {n} finger of foot' for n in ['first', 'second', 'third', 'fourth', 'fifth'] for p in PHALANX],
}
for f, word in FINGERS.items():
    for k, p in enumerate(PHALANX):
        ANCHORS[f'{f}{k + 1}.L'] = [f'{p} phalanx of {word} finger of hand']

# ---------------------------------------------------------------------------------------------
# Utilidades de malla
# ---------------------------------------------------------------------------------------------


def find(base):
    for n in (base + '.l', base):
        o = bpy.data.objects.get(n)
        if o is not None and o.type == 'MESH' and len(o.data.polygons) > 0:
            return o
    raise KeyError(base)


def to_engine(P):
    """Blender (X izq., Y posterior, Z arriba) → motor (X izq., Y arriba, Z anterior)."""
    return np.c_[P[:, 0], P[:, 2], -P[:, 1]]


def raw_mesh(o):
    me = o.data
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    me.calc_loop_triangles()
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get('vertices', tri)
    M = np.array(o.matrix_world)
    return co @ M[:3, :3].T + M[:3, 3], tri.reshape(-1, 3)


def tri_area(P, T):
    return 0.5 * np.linalg.norm(np.cross(P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]), axis=1).sum()


def evaluate(mesh_data, matrix, mods):
    """Evalúa una malla con modificadores en un objeto temporal visible."""
    tmp = bpy.data.objects.new('__tmp', mesh_data)
    bpy.context.scene.collection.objects.link(tmp)
    tmp.matrix_world = matrix
    for kind, params in mods:
        m = tmp.modifiers.new(kind.lower(), kind)
        for k, v in params.items():
            setattr(m, k, v)
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    ev = tmp.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
    me.loop_triangles.foreach_get('vertices', tri)
    tri = tri.reshape(-1, 3)
    M = np.array(tmp.matrix_world)
    co = co @ M[:3, :3].T + M[:3, 3]
    if np.linalg.det(M[:3, :3]) < 0:
        tri = tri[:, ::-1]
    ev.to_mesh_clear()
    bpy.data.objects.remove(tmp)
    return co, tri


def compact(P, T):
    used = np.unique(T)
    remap = -np.ones(len(P), dtype=np.int64)
    remap[used] = np.arange(len(used))
    return P[used], remap[T]


def decimated(o, area_per_tri, min_tris, subsurf=None):
    P, T = raw_mesh(o)
    area = tri_area(P, T)
    mods = []
    if subsurf:
        mods.append(('SUBSURF', {'levels': subsurf, 'render_levels': subsurf}))
    target = max(min_tris, area / area_per_tri)
    base_tris = len(T) * (4 ** subsurf if subsurf else 1)
    ratio = min(1.0, target / base_tris)
    if ratio < 0.999:
        mods.append(('DECIMATE', {'ratio': ratio, 'use_collapse_triangulate': True}))
    P2, T2 = evaluate(o.data, o.matrix_world, mods)
    return compact(P2, T2)


def merged_regions(objs, area_per_tri, min_tris, subsurf=1):
    """Une regiones de piel, suelda vértices comunes, suaviza (subsurf) y reduce."""
    bm = bmesh.new()
    for o in objs:
        P, T = raw_mesh(o)
        if np.linalg.det(np.array(o.matrix_world)[:3, :3]) < 0:
            T = T[:, ::-1]
        vs = [bm.verts.new(p) for p in P]
        for t in T:
            try:
                bm.faces.new((vs[t[0]], vs[t[1]], vs[t[2]]))
            except ValueError:
                pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0004)
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new('__merged')
    bm.to_mesh(me)
    bm.free()
    area = sum(p.area for p in me.polygons)
    target = max(min_tris, area / area_per_tri)
    ratio = min(1.0, target / (len(me.polygons) * 4 ** subsurf))
    mods = [('SUBSURF', {'levels': subsurf, 'render_levels': subsurf})]
    if ratio < 0.999:
        mods.append(('DECIMATE', {'ratio': ratio, 'use_collapse_triangulate': True}))
    P, T = evaluate(me, Matrix.Identity(4), mods)
    bpy.data.meshes.remove(me)
    return compact(P, T)


# ---------------------------------------------------------------------------------------------
# Puntos de referencia (centros articulares en reposo)
# ---------------------------------------------------------------------------------------------


def V(base):
    return raw_mesh(find(base))[0]


def sphere_fit(P):
    A = np.c_[2 * P, np.ones(len(P))]
    b = (P ** 2).sum(1)
    for _ in range(3):
        x, *_ = np.linalg.lstsq(A, b, rcond=None)
        c = x[:3]
        r = math.sqrt(x[3] + c @ c)
        d = np.abs(np.linalg.norm(P - c, axis=1) - r)
        keep = d < max(0.002, np.percentile(d, 70))
        A, b, P = A[keep], b[keep], P[keep]
    return c


def bone_ends(P):
    """Extremos (centroides de las puntas) a lo largo del eje principal de un hueso largo."""
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False)
    ax = vt[0]
    t = (P - c) @ ax
    span = t.max() - t.min()
    lo = P[t < t.min() + 0.08 * span].mean(0)
    hi = P[t > t.max() - 0.08 * span].mean(0)
    return lo, hi


def body_center(base):
    """Centro del cuerpo vertebral (parte anterior) y sus platillos."""
    P = V(base)
    B = P[(P[:, 1] < P[:, 1].min() + 0.028) & (np.abs(P[:, 0]) < 0.022)]
    top = B[B[:, 2] > B[:, 2].max() - 0.004].mean(0)
    bot = B[B[:, 2] < B[:, 2].min() + 0.004].mean(0)
    return top, bot


L = {}
fe = V('Femur')
top = fe[(fe[:, 2] > fe[:, 2].max() - 0.06) & (fe[:, 0] < fe[:, 0].min() + 0.05)]
L['hjc'] = sphere_fit(top)
d = fe[fe[:, 2] < fe[:, 2].min() + 0.03]
L['knee'] = np.array([(d[:, 0].min() + d[:, 0].max()) / 2, d[:, 1].mean(), fe[:, 2].min() + 0.02])
ti, fi = V('Tibia'), V('Fibula')
mm = ti[ti[:, 2] < ti[:, 2].min() + 0.006].mean(0)
lm = fi[fi[:, 2] < fi[:, 2].min() + 0.006].mean(0)
L['ankle'] = (mm + lm) / 2 + np.array([0, 0, 0.012])
cal, heel = V('Calcaneus'), V('Heel region')
L['heel'] = np.array([cal[:, 0].mean(), heel[:, 1].max(), 0.0])
dig = V('Dorsal surfaces of digits of foot')
t2 = dig[dig[:, 1] < dig[:, 1].min() + 0.004].mean(0)
L['toe'] = np.array([t2[0], t2[1], 0.0])
hu = V('Humerus')
top = hu[(hu[:, 2] > hu[:, 2].max() - 0.045) & (hu[:, 0] < hu[:, 0].min() + 0.045)]
L['gh'] = sphere_fit(top)
d = hu[hu[:, 2] < hu[:, 2].min() + 0.025]
L['elbow'] = np.array([(d[:, 0].min() + d[:, 0].max()) / 2, d[:, 1].mean(), hu[:, 2].min() + 0.012])
L['wrist'] = (V('Lunate bone').mean(0) + V('Capitate bone').mean(0)) / 2
cl = V('Clavicle')
L['sc'] = cl[cl[:, 0] < cl[:, 0].min() + 0.008].mean(0)
METACARPAL = {'i': 'Second', 'm': 'Third', 'r': 'Fourth', 'p': 'Fifth'}
for f, word in FINGERS.items():
    mc = V(f'{METACARPAL[f]} metacarpal bone')
    lo, hi = bone_ends(mc)
    L[f'{f}0'] = lo if lo[2] < hi[2] else hi  # MCP (extremo distal = más bajo en reposo)
    for k, p in enumerate(PHALANX):
        lo, hi = bone_ends(V(f'{p} phalanx of {word} finger of hand'))
        L[f'{f}{k + 1}'] = lo if lo[2] < hi[2] else hi  # extremo distal de la falange
mc1 = V('First metacarpal bone')
lo, hi = bone_ends(mc1)
L['t0'] = lo if lo[2] < hi[2] else hi
for k, p in enumerate(['Proximal', 'Distal']):
    lo, hi = bone_ends(V(f'{p} phalanx of first finger of hand'))
    L[f't{k + 1}'] = lo if lo[2] < hi[2] else hi
L['s1'] = body_center('Vertebra L5')[1]
L['l1'] = body_center('Vertebra L1')[0]
L['c7'] = body_center('Vertebra C7')[1]
L['top'] = np.array([0.0, 0.0, V('Parietal region').max(0)[2]])

# ---------------------------------------------------------------------------------------------
# Anclajes para pesos
# ---------------------------------------------------------------------------------------------

anchor_trees = {}
anchor_boxes = {}
for bone, names in ANCHORS.items():
    pts = []
    for n in names:
        try:
            P, T = raw_mesh(find(n))
        except KeyError:
            print('falta anclaje', n)
            continue
        pts.append(P)
        pts.append(P[T].mean(1))
    A = np.concatenate(pts)
    tree = KDTree(len(A))
    for i, p in enumerate(A):
        tree.insert(p, i)
    tree.balance()
    anchor_trees[bone] = tree
    anchor_boxes[bone] = (A.min(0), A.max(0))

elbow_b, wrist_b = L['elbow'], L['wrist']


def forearm_split(P, w):
    """Reparte el peso del antebrazo entre las 4 bandas de pronación según la posición axial."""
    f = wrist_b - elbow_b
    t = np.clip(((P - elbow_b) @ f) / (f @ f), 0, 1) * 3
    out = {}
    for k in range(4):
        out[f'fa{k}.L'] = w * np.clip(1 - np.abs(t - k), 0, 1)
    return out


def proximity_weights(P, T, sigma, allowed=None):
    names = [b for b in anchor_trees if allowed is None or b in allowed]
    D = np.full((len(P), len(names)), np.inf)
    for j, b in enumerate(names):
        lo, hi = anchor_boxes[b]
        tree = anchor_trees[b]
        for i, p in enumerate(P):
            gap = np.maximum(0, np.maximum(lo - p, p - hi))
            if gap @ gap > 0.2 ** 2:
                continue
            D[i, j] = tree.find(p)[2]
    dmin = D.min(1, keepdims=True)
    W = np.exp(-(D - dmin) / sigma)
    W[D - dmin > 5 * sigma] = 0
    W /= W.sum(1, keepdims=True)
    # Suavizado laplaciano sobre la malla.
    nb = np.zeros((len(P), len(names)))
    cnt = np.zeros(len(P))
    E = np.r_[T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]]
    for _ in range(3):
        nb[:] = 0
        cnt[:] = 0
        np.add.at(nb, E[:, 0], W[E[:, 1]])
        np.add.at(nb, E[:, 1], W[E[:, 0]])
        np.add.at(cnt, E[:, 0], 1)
        np.add.at(cnt, E[:, 1], 1)
        has = cnt > 0
        W[has] = 0.5 * W[has] + 0.5 * nb[has] / cnt[has, None]
    full = np.zeros((len(P), len(BONES)))
    for j, b in enumerate(names):
        if b == 'forearm.L':
            for k, v in forearm_split(P, W[:, j]).items():
                full[:, BI[k]] += v
        else:
            full[:, BI[b]] += W[:, j]
    return full


def rigid_weights(P, bone):
    full = np.zeros((len(P), len(BONES)))
    if bone == 'forearm.L':
        for k, v in forearm_split(P, np.ones(len(P))).items():
            full[:, BI[k]] += v
    else:
        full[:, BI[bone]] = 1
    return full


def finalize(W):
    """Huesos auxiliares de medio giro, 4 influencias y cuantización a 8 bits."""
    n = len(W)
    order = np.argsort(-W, axis=1)
    for i in range(n):
        a, b = order[i, 0], order[i, 1]
        wa, wb = W[i, a], W[i, b]
        if wb <= 0:
            continue
        key = (BONES[a], BONES[b]) if (BONES[a], BONES[b]) in HELPER_PAIRS else (BONES[b], BONES[a])
        h = HELPER_PAIRS.get(key)
        if h is None:
            continue
        pa, pb = (a, b) if key[0] == BONES[a] else (b, a)
        s = wa + wb
        u = W[i, pb] / s
        W[i, pa] = s * max(0.0, 1 - 2 * u)
        W[i, pb] = s * max(0.0, 2 * u - 1)
        W[i, BI[h]] += s * (1 - abs(2 * u - 1))
    idx = np.argsort(-W, axis=1)[:, :4]
    w = np.take_along_axis(W, idx, 1)
    w /= w.sum(1, keepdims=True)
    q = np.floor(w * 255 + 0.5).astype(np.int64)
    q[:, 0] += 255 - q.sum(1)
    return idx.astype(np.uint8), q.astype(np.uint8)


# ---------------------------------------------------------------------------------------------
# Exportación
# ---------------------------------------------------------------------------------------------

items = []  # (name, group, kind, P, T, W)


def add_object(base, group, kind, area_per_tri, min_tris, sigma=0.012, rigid=None, subsurf=None, allowed=None):
    o = find(base)
    P, T = decimated(o, area_per_tri, min_tris, subsurf)
    W = rigid_weights(P, rigid) if rigid else proximity_weights(P, T, sigma, allowed)
    items.append((base, group, kind, P, T, W))


for group, names in MUSCLE_GROUPS.items():
    for n in names:
        add_object(n, group, 'muscle', 0.32e-4, 120)
for n in OTHER_MUSCLES:
    add_object(n, 'otros', 'muscle', 0.4e-4, 80)
for n in TENDONS:
    add_object(n, 'tendon', 'tendon', 0.45e-4, 60)

BONE_RIG = {'Clavicle': 'girdle.L', 'Scapula': 'girdle.L', 'Humerus': 'humerus.L', 'Radius': 'forearm.L',
            'Ulna': 'forearm.L', 'Hip bone': 'pelvis', 'Sacrum': 'pelvis', 'Femur': 'thigh.L', 'Patella': 'h_kn.L',
            'Tibia': 'shank.L', 'Fibula': 'shank.L'}
for n in BONES_RENDER:
    add_object(n, 'hueso', 'bone', 0.6e-4, 60, rigid=BONE_RIG.get(n, 'thorax'))

def base_name(n):
    return n[:-2] if n[-2:] in ('.l', '.r') else n


head_regions = []
for o in bpy.data.collections['9: Regions of human body'].all_objects:
    if o.type != 'MESH' or len(o.data.polygons) == 0 or base_name(o.name) in HEAD_EXCLUDE:
        continue
    P = raw_mesh(o)[0]
    if P[:, 2].min() > 1.47 and P[:, 2].max() > 1.52:
        head_regions.append(o)


def objs(names):
    out = []
    for n in names:
        try:
            out.append(find(n))
        except KeyError:
            print('falta región', n)
    return out


skin_specs = [
    ('cabeza', head_regions, 0.010, ['neck', 'thorax']),
    ('mano', objs(HAND_REGIONS), 0.003, None),
    ('pie', objs(FOOT_REGIONS), 0.005, ['shank.L', 'foot.L']),
]
for group, names, sigma, allowed in skin_specs:
    P, T = merged_regions(names, 0.22e-4, 400)
    if group == 'cabeza':
        # Cabeza y cuello de la piel: la línea media no se refleja.
        W = proximity_weights(P, T, sigma, allowed)
        items.append(('Piel de la cabeza', 'piel', 'skin', P, T, W))
        continue
    W = proximity_weights(P, T, sigma, allowed)
    items.append((f'Piel ({group})', 'guante' if group == 'mano' else 'calzado', 'skin', P, T, W))

hair = bpy.data.objects['Hairs of head']
P, T = decimated(hair, 0.5e-4, 600)
items.append(('Hairs of head', 'pelo', 'skin', P, T, rigid_weights(P, 'neck')))
for n, g in [('Sclera', 'ojo'), ('Iris', 'iris')]:
    o = bpy.data.objects[f'{n}.l']
    P, T = decimated(o, 0.15e-4, 120, subsurf=None)
    items.append((n, g, 'skin', P, T, rigid_weights(P, 'neck')))

# Empaquetado.
allP = np.concatenate([to_engine(it[3]) for it in items])
lo = allP.min(0) - 1e-4
hi = allP.max(0) + 1e-4
objects = []
pos_chunks, idx_chunks, si_chunks, sw_chunks = [], [], [], []
v_off = 0
i_off = 0
for name, group, kind, P, T, W in items:
    Pe = to_engine(P)
    q = np.round((Pe - lo) / (hi - lo) * 65535).astype(np.uint16)
    si, sw = finalize(W)
    mirror = bool(P[:, 0].min() > -0.01)
    objects.append({'name': name, 'group': group, 'kind': kind, 'mirror': mirror,
                    'v': [v_off, len(P)], 'i': [i_off, int(T.size)]})
    pos_chunks.append(q.reshape(-1))
    si_chunks.append(si.reshape(-1))
    sw_chunks.append(sw.reshape(-1))
    idx_chunks.append(T.astype(np.uint16).reshape(-1))
    v_off += len(P)
    i_off += T.size

pos = np.concatenate(pos_chunks)
idx = np.concatenate(idx_chunks)
si = np.concatenate(si_chunks)
sw = np.concatenate(sw_chunks)
blob = pos.tobytes() + idx.tobytes() + si.tobytes() + sw.tobytes()
landmarks = {k: [round(float(x), 5) for x in to_engine(np.asarray(v, dtype=float).reshape(1, 3))[0]] for k, v in L.items()}
manifest = {
    'bones': BONES,
    'helpers': {v: list(k) for k, v in HELPER_PAIRS.items()},
    'bbox': [lo.round(6).tolist(), hi.round(6).tolist()],
    'counts': {'vertices': int(v_off), 'indices': int(i_off)},
    'layout': {'position': [0, int(pos.nbytes)], 'index': [int(pos.nbytes), int(idx.nbytes)],
               'skinIndex': [int(pos.nbytes + idx.nbytes), int(si.nbytes)],
               'skinWeight': [int(pos.nbytes + idx.nbytes + si.nbytes), int(sw.nbytes)]},
    'landmarks': landmarks,
    'objects': objects,
}
header = (
    '// Generado por scripts/anatomy/export_zanatomy.py — no editar a mano.\n'
    '// Modelo anatómico derivado de Z-Anatomy (CC BY-SA 4.0, https://www.z-anatomy.com), basado en\n'
    '// BodyParts3D, © The Database Center for Life Science (CC BY-SA 2.1 Japan).\n'
    '// Este fichero se distribuye bajo CC BY-SA 4.0.\n'
)
with open(OUT, 'w') as fh:
    fh.write(header)
    fh.write('export const ANATOMY_MANIFEST = ' + json.dumps(manifest, separators=(',', ':')) + ' as const;\n')
    fh.write("export const ANATOMY_BIN = '" + base64.b64encode(blob).decode() + "';\n")
print('objetos', len(objects), 'vértices', v_off, 'triángulos', i_off // 3, 'binario KB', len(blob) // 1024)
for g in sorted({o['group'] for o in objects}):
    vs = sum(o['v'][1] for o in objects if o['group'] == g)
    print(f'  {g:20s} {vs}')
