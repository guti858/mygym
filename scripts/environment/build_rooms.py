"""
Genera con Blender (bpy) las dos salas de MyGym, hornea su iluminación con Cycles y las exporta
en un único glTF binario.

  * «station»: sala cuadrada en la que se ve cada estación (espejos, ventanales, almacén de pesos,
    espaldera...).
  * «hub»: el gimnasio completo, con el suelo de cada zona, ventanales, taquillas y la entrada.

Todo es geometría procedural (sin modelos ni texturas externas), así que el resultado es
reproducible y sin problemas de licencias. Qué hace:

  1. Construye la geometría por grupos. Cada pared y lo que cuelga de ella forman grupos con la
     clave `fade` (xp, xn, zp, zn): la app los desvanece cuando esa pared queda entre la cámara y la
     máquina. El zócalo («base») queda siempre visible, como en un corte de maqueta.
  2. Genera texturas de detalle sin costuras con numpy (caucho en losetas, enlucido, paneles,
     madera, hormigón): ruido periódico filtrado en frecuencia, que encaja al repetirse.
  3. Hornea con Cycles la irradiancia difusa (luz directa + rebotes, sin el color del material) de
     las luminarias del techo y del sol y el cielo que entran por los ventanales:
       - superficies grandes (suelo, paredes, muebles) → atlas de luz común a la sala (UV 1);
       - atrezo pequeño (mancuernas, discos, plantas...) → color de vértice, que no gasta atlas.
     El techo existe durante el horneado (rebotes) pero no se exporta: la cámara mira desde arriba.
  4. Quita el ruido del atlas con un filtro bilateral guiado por la posición y la normal horneadas
     (no mezcla superficies distintas) y normaliza la exposición: la mediana del suelo vale 1.
  5. Exporta. Cada material lleva su textura de detalle como color base (UV 0) y el atlas como
     textura emisiva (UV 1); en la app pasan a `map` y `lightMap` de un MeshBasicMaterial teñido con
     los colores del tema activo (src/scene/env/). Una escena glTF por sala.

El glTF se escribe además como módulo TypeScript en base64 (`<salida>.generated.ts`, igual que el
modelo anatómico): así llega en un fragmento aparte del bundle tanto a Vite como al render de
Remotion y a la versión publicada, que no admiten ficheros .glb sueltos. Es obra original del
proyecto (sin datos de terceros).

Uso (Blender 5.2 como módulo de Python: `pip install bpy==5.2.2` en un entorno virtual):
  npx tsx scripts/environment/layout.ts
  python -I scripts/environment/build_rooms.py scripts/environment/layout.json src/scene/env/gym-env
Opciones: --samples N (64), --station-res N (1024), --hub-res N (2048), --quick (prueba rápida).
Al final, compact_glb.py quita lo que la app no usa (normales, UV de detalle de materiales lisos).
"""

import json
import math
import os
import sys
import time

import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np
from mathutils import Matrix, Vector

ARGS = sys.argv[1:]
LAYOUT, OUT = ARGS[0], ARGS[1]


def opt(name, default):
    return type(default)(ARGS[ARGS.index(name) + 1]) if name in ARGS else default


QUICK = '--quick' in ARGS
SAMPLES = opt('--samples', 8 if QUICK else 64)
RES = {'station': opt('--station-res', 512 if QUICK else 1024), 'hub': opt('--hub-res', 1024 if QUICK else 2048)}
L = json.load(open(LAYOUT))
T0 = time.time()


def log(*a):
    print(f'[{time.time() - T0:6.1f}s]', *a, flush=True)


# ---------------------------------------------------------------------------------------------
# Ejes: todo se escribe en los de la escena de la app (X derecha, Y arriba, Z hacia la cámara
# frontal) y se pasa a los de Blender (Z arriba) al crear los vértices. El exportador glTF deshace
# el cambio, así que los nodos llegan a three.js con las mismas coordenadas.
# ---------------------------------------------------------------------------------------------
TO_B = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
TO_APP = TO_B.inverted()
UP = Vector((0, 1, 0))


def V(*c):
    return Vector(c[0] if len(c) == 1 else c)


# ---------------------------------------------------------------------------------------------
# Materiales («ranuras»). La app tiñe cada una con el color del tema (src/scene/env/roomMaterials.ts);
# aquí el color solo sirve para que los rebotes de luz tengan el tono correcto (tema claro).
# ---------------------------------------------------------------------------------------------
SLOTS = {
    # ranura: (textura de detalle, metros que cubre la textura, color para el horneado)
    'floor': ('rubber', 2.0, '#b4bac3'),
    'zone_traccion': ('rubber', 2.0, '#c9d5e2'),
    'zone_brazos': ('rubber', 2.0, '#d3cde2'),
    'zone_pierna': ('rubber', 2.0, '#c9dccd'),
    'zone_empuje': ('rubber', 2.0, '#e2cfc8'),
    'zone_libre': ('rubber', 2.0, '#e0d9c0'),
    'line': (None, 1, '#f5f5f2'),
    'wall': ('plaster', 2.0, '#e7e9ed'),
    'wallLow': ('panel', 2.4, '#d2d7de'),
    'accent': (None, 1, '#e8611d'),
    'skirt': (None, 1, '#9ba2ac'),
    'concrete': ('concrete', 1.5, '#c4c7cc'),
    'frame': (None, 1, '#3c434e'),
    'metal': (None, 1, '#8b95a3'),
    'iron': (None, 1, '#2a2e34'),
    'pad': (None, 1, '#2b3038'),
    'wood': ('wood', 1.0, '#c49a6c'),
    'plant': (None, 1, '#4f7d4a'),
    'screen': (None, 1, '#1d2329'),
    'decal': (None, 1, '#e8611d'),
    'plate25': (None, 1, '#d7263d'),
    'plate20': (None, 1, '#1b6ac9'),
    'plate15': (None, 1, '#f2c12e'),
    'plate10': (None, 1, '#2e9e5b'),
    'plate5': (None, 1, '#e9ecef'),
    'mirror': (None, 1, '#cfdbe8'),
    'window': (None, 1, '#dbe8f5'),
    'led': (None, 1, '#fff4de'),
}


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(srgb_to_linear([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]))


# ---------------------------------------------------------------------------------------------
# Texturas de detalle sin costuras (escala de grises, media ≈ 0,9: el color lo pone el tema)
# ---------------------------------------------------------------------------------------------
def periodic_noise(n, feature_px, rng):
    """Ruido gaussiano periódico (encaja al repetirse) con detalles de ~feature_px píxeles."""
    f = np.fft.fftfreq(n)
    r2 = f[:, None] ** 2 + f[None, :] ** 2
    spec = np.fft.fft2(rng.standard_normal((n, n))) * np.exp(-r2 * (math.pi * feature_px) ** 2 / 2)
    out = np.fft.ifft2(spec).real
    return (out - out.mean()) / (out.std() + 1e-9)


def tex_rubber(n, rng):
    """2 × 2 losetas de caucho de 1 m: tono propio por loseta, granulado, motas de EPDM y juntas."""
    img = np.full((n, n), 0.9)
    h = n // 2
    for i in range(2):
        for j in range(2):
            img[i * h:(i + 1) * h, j * h:(j + 1) * h] += rng.uniform(-0.035, 0.035)
    img += 0.035 * periodic_noise(n, 1.2, rng) + 0.02 * periodic_noise(n, 40, rng)
    for _ in range(int(n * n * 0.012)):
        y, x = rng.integers(0, n, 2)
        s = rng.integers(1, 3)
        img[y:y + s, x:x + s] += rng.choice([-0.22, 0.18])
    # Juntas: línea oscura con el borde biselado más claro.
    for t in (0, h):
        for d, v in ((0, -0.32), (1, -0.32), (-1, -0.22), (2, -0.1), (-2, -0.1)):
            img[(t + d) % n, :] += v
            img[:, (t + d) % n] += v
    return np.clip(img, 0, 1)


def tex_plaster(n, rng):
    img = 0.93 + 0.022 * periodic_noise(n, 90, rng) + 0.014 * periodic_noise(n, 14, rng) + 0.018 * periodic_noise(n, 1.0, rng)
    return np.clip(img, 0, 1)


def tex_panel(n, rng):
    """Panel laminado de zócalo: juntas verticales cada 1,2 m y un veteado muy suave."""
    img = 0.9 + 0.02 * periodic_noise(n, 60, rng) + 0.012 * periodic_noise(n, 1.2, rng)
    cols = np.arange(n)
    stretch = 0.012 * periodic_noise(n, 3, rng)[0]
    img += (0.02 * np.sin(cols * 2 * math.pi * 24 / n) + stretch)[None, :]
    for t in (0, n // 2):
        for d, v in ((0, -0.35), (1, -0.35), (-1, -0.15), (2, -0.1)):
            img[:, (t + d) % n] += v
    return np.clip(img, 0, 1)


def tex_wood(n, rng):
    """Veta de madera periódica (las vetas recorren la textura en vertical)."""
    u = np.arange(n)[None, :] / n
    warp = 0.06 * periodic_noise(n, 70, rng) + 0.01 * periodic_noise(n, 6, rng)
    rings = np.sin((u + warp) * 2 * math.pi * 18)
    img = 0.86 + 0.07 * rings ** 3 + 0.03 * periodic_noise(n, 1.0, rng)
    return np.clip(img, 0, 1)


def tex_concrete(n, rng):
    img = 0.9 + 0.035 * periodic_noise(n, 70, rng) + 0.02 * periodic_noise(n, 8, rng) + 0.025 * periodic_noise(n, 1.0, rng)
    for _ in range(int(n * n * 0.002)):
        y, x = rng.integers(0, n, 2)
        img[y:y + 2, x:x + 2] -= 0.25
    return np.clip(img, 0, 1)


DETAIL_GEN = {'rubber': (1024, tex_rubber), 'plaster': (1024, tex_plaster), 'panel': (1024, tex_panel), 'wood': (512, tex_wood), 'concrete': (512, tex_concrete)}


def make_detail_images():
    imgs = {}
    for k, (n, gen) in DETAIL_GEN.items():
        g = gen(n, np.random.default_rng(sum(map(ord, k))))
        im = bpy.data.images.new(f'detail_{k}', n, n, alpha=False)
        im.colorspace_settings.name = 'sRGB'
        rgba = np.ones((n, n, 4), dtype=np.float32)
        rgba[..., :3] = g[..., None]
        im.pixels.foreach_set(rgba.ravel())
        im.file_format = 'JPEG'
        im.pack()
        imgs[k] = im
    return imgs


# ---------------------------------------------------------------------------------------------
# Construcción de geometría
# ---------------------------------------------------------------------------------------------
class Part:
    """Un grupo de la sala (acaba siendo un objeto, y un nodo en el glTF).

    `light`: 'atlas' (atlas de luz), 'vertex' (luz en color de vértice) o 'none' (sin luz
    horneada: vidrio, espejos, LED y rótulos, que la app pinta con material propio)."""

    def __init__(self, room, name, fade='', light='atlas', shadow=True, cull=(), keep=()):
        self.room, self.name, self.fade, self.light, self.shadow = room, name, fade, light, shadow
        # Se descartan las caras que miran hacia `cull` y, si se indica `keep`, las que no miran
        # hacia ninguna de esas direcciones (ejes de la app).
        self.cull = [TO_B @ V(c) for c in cull]
        self.keep = [TO_B @ V(k) for k in keep]
        self.bm = bmesh.new()
        self.slots = []
        room.parts.append(self)

    def _mi(self, slot):
        assert slot in SLOTS, slot
        if slot not in self.slots:
            self.slots.append(slot)
        return self.slots.index(slot)

    def add(self, tmp, slot, m=None, smooth=False):
        """Copia un bmesh temporal (ejes de la app) aplicando la matriz `m` (ejes de la app)."""
        mi = self._mi(slot)
        M = TO_B @ (m.to_3x3() if m is not None else Matrix.Identity(3))
        t = TO_B @ (m.translation if m is not None else Vector())
        vmap = {}
        for v in tmp.verts:
            vmap[v] = self.bm.verts.new(M @ v.co + t)
        for f in tmp.faces:
            nf = self.bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = mi
            nf.smooth = smooth and f.smooth
        tmp.free()

    # --- primitivas (ejes de la app) ---
    def box(self, lo, hi, slot):
        lo, hi = V(lo), V(hi)
        size = hi - lo
        if min(size) <= 1e-5:
            return
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1)
        m = Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal((*size, 1))
        self.add(tmp, slot, m)

    def cyl(self, a, b, r, slot, segs=16, r2=None):
        a, b = V(a), V(b)
        d = b - a
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=d.length)
        for f in tmp.faces:
            f.smooth = abs(f.normal.z) < 0.5
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        self.add(tmp, slot, Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), smooth=True)

    def sphere(self, c, r, slot, segs=16, squash=1.0):
        tmp = bmesh.new()
        bmesh.ops.create_uvsphere(tmp, u_segments=segs, v_segments=max(6, segs // 2), radius=r)
        for f in tmp.faces:
            f.smooth = True
        self.add(tmp, slot, Matrix.Translation(V(c)) @ Matrix.Diagonal((1, squash, 1, 1)), smooth=True)

    def torus(self, c, axis, R, r, slot, segs=18, rsegs=8):
        tmp = bmesh.new()
        rings = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring = []
            for j in range(rsegs):
                b = 2 * math.pi * j / rsegs
                ring.append(tmp.verts.new(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
            rings.append(ring)
        for i in range(segs):
            for j in range(rsegs):
                f = tmp.faces.new((rings[i][j], rings[(i + 1) % segs][j], rings[(i + 1) % segs][(j + 1) % rsegs], rings[i][(j + 1) % rsegs]))
                f.smooth = True
        q = Vector((0, 0, 1)).rotation_difference(V(axis).normalized())
        self.add(tmp, slot, Matrix.Translation(V(c)) @ q.to_matrix().to_4x4(), smooth=True)

    def grid(self, xs, zs, slot_at, y=0.0):
        """Suelo como una sola malla conexa (una isla en el atlas, sin costuras de luz): rejilla
        con cortes en `xs` × `zs` y la ranura de cada celda según `slot_at(x, z)` en su centro."""
        vs = {}
        for i, x in enumerate(xs):
            for j, z in enumerate(zs):
                vs[i, j] = self.bm.verts.new(TO_B @ Vector((x, y, z)))
        for i in range(len(xs) - 1):
            for j in range(len(zs) - 1):
                f = self.bm.faces.new((vs[i, j], vs[i, j + 1], vs[i + 1, j + 1], vs[i + 1, j]))
                f.material_index = self._mi(slot_at((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2))

    def text(self, body, origin, right, height, slot, depth=0.012):
        """Rótulo en relieve: `origin` = inicio de la línea base, `right` = dirección de lectura.
        Se lee de frente desde el lado hacia el que apunta `right × arriba`."""
        cu = bpy.data.curves.new('rotulo', 'FONT')
        cu.body = body
        cu.size = 1
        cu.extrude = depth / height / 2
        cu.offset = 0.012
        ob = bpy.data.objects.new('rotulo', cu)
        bpy.context.scene.collection.objects.link(ob)
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        tmp = bmesh.new()
        tmp.from_mesh(me)
        bpy.data.meshes.remove(me)
        bmesh.ops.triangulate(tmp, faces=tmp.faces[:])
        # Ejes locales de la curva: X lectura, Y altura de la letra, Z grosor.
        r = V(right).normalized()
        n = r.cross(UP)
        m = Matrix.Identity(4)
        m.col[0][:3] = r * height
        m.col[1][:3] = UP * height
        m.col[2][:3] = n * height
        m.translation = V(origin) + n * depth / 2
        self.add(tmp, slot, m)

    def finish(self, materials):
        bm = self.bm
        bm.normal_update()
        # Caras inferiores apoyadas en el suelo: nunca se ven.
        dead = {f for f in bm.faces if f.normal.z < -0.99 and f.calc_center_median().z < 0.005}
        dead |= {f for f in bm.faces if any(f.normal.dot(c) > 0.99 for c in self.cull)}
        if self.keep:
            dead |= {f for f in bm.faces if not any(f.normal.dot(k) > 0.99 for k in self.keep)}
        bmesh.ops.delete(bm, geom=list(dead), context='FACES_ONLY')
        uv = bm.loops.layers.uv.new('detail')
        for f in bm.faces:
            scale = SLOTS[self.slots[f.material_index]][1]
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for lp in f.loops:
                c = lp.vert.co
                lp[uv].uv = (c.x / scale, c.y / scale) if ax == 2 else (c.y / scale, c.z / scale) if ax == 0 else (c.x / scale, c.z / scale)
        name = f'{self.room.name}/{self.name}'
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        if self.light == 'atlas':
            me.uv_layers.new(name='lightmap')
        if self.light == 'vertex':
            attr = me.color_attributes.new('light', 'FLOAT_COLOR', 'CORNER')
            me.color_attributes.active_color = attr
            me.color_attributes.render_color_index = me.color_attributes.active_color_index
        ob = bpy.data.objects.new(name, me)
        for s in self.slots:
            me.materials.append(materials[s, self.light])
        ob['fade'] = self.fade
        ob['light'] = self.light
        if not self.shadow:
            ob.visible_shadow = False
        self.room.coll.objects.link(ob)
        self.obj = ob
        return ob


class Room:
    def __init__(self, name):
        self.name = name
        self.parts = []
        self.coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(self.coll)
        self.bake_only = []  # techo, luminarias y luces: solo para el horneado

    def part(self, name, **kw):
        return Part(self, name, **kw)


class WallFrame:
    """Marco local de una pared: u a lo largo (a la derecha mirándola desde dentro), v altura,
    d hacia el interior de la sala (la cara interior está en d = 0)."""

    def __init__(self, key, half_x, half_z):
        self.key = key
        n = {'xp': (-1, 0, 0), 'xn': (1, 0, 0), 'zp': (0, 0, -1), 'zn': (0, 0, 1)}[key]
        self.n = V(n)
        self.r = (-self.n).cross(UP)
        self.half_d = half_x if key[0] == 'x' else half_z
        self.length = 2 * (half_z if key[0] == 'x' else half_x)
        self.o = -self.n * self.half_d

    def p(self, u, v, d=0.0):
        return self.o + self.r * u + UP * v + self.n * d

    def box(self, part, u0, u1, v0, v1, d0, d1, slot):
        a, b = self.p(u0, v0, d0), self.p(u1, v1, d1)
        part.box([min(a[i], b[i]) for i in range(3)], [max(a[i], b[i]) for i in range(3)], slot)

    def cyl(self, part, a, b, r, slot, **kw):
        part.cyl(self.p(*a), self.p(*b), r, slot, **kw)

    def sphere(self, part, c, r, slot, **kw):
        part.sphere(self.p(*c), r, slot, **kw)


class Wall:
    """Una pared con sus grupos.

    - base: cara interior del zócalo que nunca se oculta (atlas); edge: el resto del zócalo (canto
      superior, cara exterior y testas), que en el horneado queda tapado o mira fuera y se pinta
      sin luz horneada.
    - shell: el muro (atlas, sin cara exterior ni canto); top: su canto superior (sin luz: en el
      horneado lo tapa el techo).
    - solid: carpinterías y alféizares; furniture: muebles (atlas); props: atrezo pequeño (vértice).
    """

    def __init__(self, room, fr):
        self.room, self.fr, self.key = room, fr, fr.key
        self.base = room.part(f'base_{fr.key}')
        self.edge = room.part(f'edge_{fr.key}', light='none')
        self.shell = room.part(f'wall_{fr.key}', fade=fr.key, cull=[-fr.n])
        self.top = room.part(f'top_{fr.key}', fade=fr.key, light='none')
        self.solid = room.part(f'frames_{fr.key}', fade=fr.key)
        self.furniture = room.part(f'furniture_{fr.key}', fade=fr.key)
        self.props = room.part(f'props_{fr.key}', fade=fr.key, light='vertex')


def move_faces(src, dst, pred):
    """Pasa a otro grupo las caras de `src` que cumplen `pred(centro, normal)` (ejes de la app)."""
    src.bm.normal_update()
    moved = [f for f in src.bm.faces if pred(TO_APP @ f.calc_center_median(), TO_APP @ f.normal)]
    vmap = {}
    for f in moved:
        vs = [vmap.setdefault(v, dst.bm.verts.new(v.co)) for v in f.verts]
        nf = dst.bm.faces.new(vs)
        nf.material_index = dst._mi(src.slots[f.material_index])
    bmesh.ops.delete(src.bm, geom=moved, context='FACES')


THICK = 0.16  # grosor de pared
CUT = 0.3  # altura del zócalo que queda al «cortar» una pared cercana
LOW = 1.1  # altura del zócalo de paneles


def wall_rects(u0, u1, v0, v1, openings):
    """Rectángulos macizos de la banda [u0,u1]×[v0,v1] descontando los huecos (u0,u1,v0,v1)."""
    vs = sorted({v0, v1, *[x for o in openings for x in (o[2], o[3]) if v0 < x < v1]})
    out = []
    for a, b in zip(vs, vs[1:]):
        holes = sorted((o[0], o[1]) for o in openings if o[2] < b - 1e-6 and o[3] > a + 1e-6)
        cur = u0
        for h0, h1 in holes:
            if h0 > cur:
                out.append((cur, h0, a, b))
            cur = max(cur, h1)
        if cur < u1:
            out.append((cur, u1, a, b))
    return out


def build_wall(room, fr, height, openings=()):
    """Pared con zócalo de paneles, franja de color, enlucido y huecos de ventana o puerta."""
    w = Wall(room, fr)
    # Las paredes en X cubren las esquinas; las de Z se meten 2 mm en ellas (sin caras coplanarias).
    L = fr.length / 2 + (THICK if fr.key[0] == 'x' else 0.002)
    for r in wall_rects(-L, L, 0, CUT, openings):
        fr.box(w.base, *r, -THICK, 0, 'wallLow')
    for r in wall_rects(-fr.length / 2, fr.length / 2, 0, 0.1, openings):
        fr.box(w.base, *r, 0, 0.012, 'skirt')
    for v0, v1, slot in ((CUT, LOW, 'wallLow'), (LOW, LOW + 0.06, 'accent'), (LOW + 0.06, height, 'wall')):
        for r in wall_rects(-L, L, v0, v1, openings):
            fr.box(w.shell, *r, -THICK, 0, slot)
    # Caras que en el horneado quedan tapadas (por el techo o por la pared vecina) o miran fuera:
    # sin luz horneada, para que no salgan negras al cortar la pared. Del zócalo solo se hornea la
    # cara interior; del muro, el canto superior y las testas de las esquinas van aparte.
    move_faces(w.base, w.edge, lambda c, n: n.dot(fr.n) < 0.99)
    move_faces(w.shell, w.top, lambda c, n: (n.y > 0.99 and c.y > height - 1e-3) or (abs(n.dot(fr.r)) > 0.99 and abs((c - fr.o).dot(fr.r)) > L - 1e-3))
    return w


def window(w, u0, u1, v0, v1, mullions=2):
    """Ventana: vidrio (cielo en la app), carpintería y alféizar."""
    fr = w.fr
    glass = w.room.part(f'glass_{fr.key}_{len(w.room.parts)}', fade=fr.key, light='none', shadow=False)
    fr.box(glass, u0, u1, v0, v1, -THICK * 0.55, -THICK * 0.5, 'window')
    t = 0.05
    for a, b, c, d in ((u0, u1, v0, v0 + t), (u0, u1, v1 - t, v1), (u0, u0 + t, v0, v1), (u1 - t, u1, v0, v1)):
        fr.box(w.solid, a, b, c, d, -THICK * 0.6, -THICK * 0.35, 'line')
    for k in range(1, mullions + 1):
        u = u0 + (u1 - u0) * k / (mullions + 1)
        fr.box(w.solid, u - t / 2, u + t / 2, v0, v1, -THICK * 0.6, -THICK * 0.4, 'line')
    # Alféizar un pelo por encima del hueco: sin caras coplanarias con el muro.
    fr.box(w.solid, u0 - 0.04, u1 + 0.04, v0 - 0.04, v0 + 0.006, -THICK - 0.004, 0.06, 'concrete')


def mirror(w, u0, u1, v0, v1):
    fr = w.fr
    m = w.room.part(f'mirror_{fr.key}_{len(w.room.parts)}', fade=fr.key, light='none')
    fr.box(w.furniture, u0 - 0.025, u1 + 0.025, v0 - 0.025, v1 + 0.025, 0, 0.018, 'metal')
    fr.box(m, u0, u1, v0, v1, 0.018, 0.024, 'mirror')


def led_strip(w, u0, u1, v):
    s = w.room.part(f'led_{w.key}_{len(w.room.parts)}', fade=w.key, light='none')
    w.fr.box(s, u0, u1, v, v + 0.035, 0.02, 0.06, 'led')


def sign(w, u, v, h, text='MYGYM', sub='GUION ARTICULAR'):
    """Rótulo en relieve: marca y subtítulo (con el bloque de color de la cabecera de la app).
    Sin luz horneada: las letras son cientos de triángulos diminutos; la app las tiñe sin más."""
    fr = w.fr
    part = w.room.part(f'sign_{fr.key}', fade=fr.key, light='none')
    part.text(text, fr.p(u, v, 0.0), fr.r, h, 'decal', depth=0.025)
    wd = 0.62 * h * len(text)
    fr.box(part, u + wd + 0.04, u + wd + 0.04 + h * 0.16, v + h * 0.25, v + h * 0.55, 0, 0.02, 'decal')
    if sub:
        part.text(sub, fr.p(u + wd + 0.04 + h * 0.3, v + h * 0.22, 0.0), fr.r, h * 0.3, 'frame', depth=0.012)


# --- atrezo ----------------------------------------------------------------------------------
PLATE_SPEC = {25: (0.45, 0.055), 20: (0.45, 0.048), 15: (0.40, 0.040), 10: (0.33, 0.034), 5: (0.23, 0.027)}


def dumbbell(part, c, axis, size):
    """Mancuerna hexagonal a lo largo de `axis`."""
    c, ax = V(c), V(axis).normalized()
    r = 0.04 + 0.02 * size
    ln = 0.045 + 0.025 * size
    part.cyl(c - ax * 0.08, c + ax * 0.08, 0.016, 'metal', segs=10)
    for s in (-1, 1):
        a = c + ax * s * 0.08
        part.cyl(a, a + ax * s * ln, r, 'iron', segs=6)


def dumbbell_rack(w, u0, u1, d0=0.08):
    """Estantería de dos alturas con mancuernas de menor a mayor."""
    fr, part = w.fr, w.props
    depth = 0.55
    for u in (u0, u1):
        fr.box(part, u - 0.03, u + 0.03, 0, 0.84, d0 + 0.05, d0 + 0.11, 'frame')
        fr.box(part, u - 0.03, u + 0.03, 0, 0.52, d0 + depth - 0.1, d0 + depth - 0.04, 'frame')
        fr.box(part, u - 0.03, u + 0.03, 0, 0.05, d0, d0 + depth, 'frame')
    fr.box(part, u0, u1, 0.8, 0.84, d0 + 0.02, d0 + 0.2, 'frame')
    fr.box(part, u0, u1, 0.48, 0.52, d0 + depth - 0.2, d0 + depth, 'frame')
    n = max(3, int((u1 - u0) / 0.36))
    for i in range(n):
        u = u0 + (u1 - u0) * (i + 0.5) / n
        t = i / max(1, n - 1)
        dumbbell(part, fr.p(u, 0.9 + 0.01 * t, d0 + 0.11), fr.n, 0.2 + 0.8 * t)
        dumbbell(part, fr.p(u, 0.6 + 0.02 * t, d0 + depth - 0.12), fr.n, 1.0 + 0.9 * t)


def plate_tree(w, u, d=0.42):
    fr, part = w.fr, w.props
    fr.box(part, u - 0.32, u + 0.32, 0, 0.04, d - 0.24, d + 0.24, 'frame')
    fr.cyl(part, (u, 0, d), (u, 1.15, d), 0.035, 'frame', segs=8)
    for v, side, kgs in ((0.32, 1, (25, 25)), (0.32, -1, (20, 20)), (0.74, 1, (15, 10)), (0.74, -1, (10, 5, 5))):
        fr.cyl(part, (u, v, d), (u + side * 0.25, v, d), 0.022, 'metal', segs=8)
        off = 0.05
        for kg in kgs:
            dia, th = PLATE_SPEC[kg]
            y = max(v, dia / 2 + 0.045)
            fr.cyl(part, (u + side * off, y, d), (u + side * (off + th), y, d), dia / 2, f'plate{kg}', segs=28)
            fr.cyl(part, (u + side * (off - 0.002), y, d), (u + side * (off + th + 0.002), y, d), 0.03, 'metal', segs=10)
            off += th + 0.004


def kettlebells(w, u0, d=0.25, n=4):
    for i in range(n):
        k = 0.75 + 0.15 * i
        c = w.fr.p(u0 + i * 0.3, 0.1 * k, d)
        w.props.sphere(c, 0.1 * k, 'iron', segs=14, squash=0.95)
        w.props.torus(c + UP * (0.105 * k), w.fr.n, 0.055 * k, 0.014 * k, 'iron')


def plyo_boxes(w, u, d=0.35):
    for v0, h, s, du in ((0, 0.6, 0.7, 0), (0.6, 0.45, 0.6, 0.03), (1.05, 0.3, 0.5, -0.02)):
        w.fr.box(w.furniture, u - s / 2 + du, u + s / 2 + du, v0, v0 + h, d - s * 0.4, d + s * 0.4, 'wood')


def wall_bars(w, u0, u1, height=2.5):
    """Espaldera de madera."""
    for u in (u0, u1):
        w.fr.box(w.furniture, u - 0.035, u + 0.035, 0, height, 0.02, 0.13, 'wood')
    v = 0.15
    while v < height - 0.05:
        w.fr.cyl(w.props, (u0, v, 0.09), (u1, v, 0.09), 0.017, 'wood', segs=8)
        v += 0.155


def foam_rollers(w, u, d=0.2):
    for i in range(3):
        w.fr.cyl(w.props, (u - 0.3, 0.075, d + i * 0.16), (u + 0.3, 0.075, d + i * 0.16), 0.075, 'accent' if i == 1 else 'pad', segs=14)


def med_balls(w, u):
    """Balda con balones medicinales."""
    w.fr.box(w.furniture, u - 0.5, u + 0.5, 0.6, 0.63, 0, 0.32, 'frame')
    for i, r in enumerate((0.12, 0.13, 0.14)):
        w.fr.sphere(w.props, (u - 0.32 + i * 0.32, 0.63 + r, 0.16), r, 'pad' if i != 1 else 'accent')


def plant(w, u, d=0.33, h=1.2, seed=0):
    part = w.props
    rng = np.random.default_rng(seed)
    c = w.fr.p(u, 0, d)
    w.furniture.cyl(c, c + UP * 0.42, 0.2, 'concrete', segs=20, r2=0.24)
    part.cyl(c + UP * 0.4, c + UP * 0.43, 0.21, 'iron', segs=20)
    for i in range(9):
        a = 2 * math.pi * i / 9 + rng.uniform(-0.3, 0.3)
        ln = h * rng.uniform(0.45, 0.75)
        tip = c + UP * (0.42 + ln) + Vector((math.cos(a), 0, math.sin(a))) * ln * rng.uniform(0.25, 0.45)
        part.cyl(c + UP * 0.4, tip, 0.02, 'plant', segs=5, r2=0.005)
        part.sphere(tip, rng.uniform(0.09, 0.14), 'plant', segs=8, squash=0.6)


def tv(w, u, v, wd=1.1):
    h = wd * 9 / 16
    w.fr.box(w.furniture, u - wd / 2, u + wd / 2, v, v + h, 0.02, 0.07, 'iron')
    w.fr.box(w.furniture, u - wd / 2 + 0.02, u + wd / 2 - 0.02, v + 0.02, v + h - 0.02, 0.07, 0.075, 'screen')


def clock(w, u, v):
    fr, part = w.fr, w.props
    c = fr.p(u, v, 0.03)
    part.cyl(c - fr.n * 0.03, c + fr.n * 0.02, 0.17, 'iron', segs=28)
    part.cyl(c + fr.n * 0.02, c + fr.n * 0.025, 0.15, 'line', segs=28)
    for a in range(12):
        t = 2 * math.pi * a / 12
        p = c + fr.n * 0.027 + (fr.r * math.cos(t) + UP * math.sin(t)) * 0.12
        part.box(p - Vector((0.008, 0.008, 0.008)), p + Vector((0.008, 0.008, 0.008)), 'iron')


def bench(w, u0, u1, d=0.3):
    """Banco de listones bajo las ventanas."""
    for u in (u0 + 0.1, u1 - 0.1):
        w.fr.box(w.furniture, u - 0.03, u + 0.03, 0, 0.42, d - 0.16, d + 0.16, 'frame')
    for k in range(4):
        dd = d - 0.15 + k * 0.1
        w.fr.box(w.furniture, u0, u1, 0.42, 0.45, dd, dd + 0.08, 'wood')


def lockers(w, u0, u1, h=1.9, d=0.5):
    fr, part = w.fr, w.furniture
    n = int((u1 - u0) / 0.4)
    wd = (u1 - u0) / n
    fr.box(part, u0, u1, 0, 0.1, 0, d - 0.04, 'iron')
    fr.box(part, u0, u1, h, h + 0.04, 0, d, 'frame')
    for i in range(n):
        a = u0 + i * wd
        fr.box(part, a + 0.006, a + wd - 0.006, 0.1, h, 0, d, 'metal')
        for k in range(3):
            fr.box(w.props, a + 0.08, a + wd - 0.08, 1.6 + k * 0.05, 1.62 + k * 0.05, d, d + 0.004, 'frame')
        fr.box(w.props, a + wd - 0.08, a + wd - 0.05, 1.0, 1.12, d, d + 0.02, 'iron')


def water_fountain(w, u, d=0.2):
    w.fr.box(w.furniture, u - 0.2, u + 0.2, 0, 0.95, 0, d * 2, 'metal')
    w.fr.box(w.furniture, u - 0.2, u + 0.2, 0.95, 1.0, 0, d * 2, 'frame')
    w.fr.cyl(w.props, (u, 1.0, d), (u, 1.38, d), 0.13, 'window', segs=18)


def door(w, u0, u1, h=2.2):
    """Doble puerta de vidrio con marco y tiradores."""
    fr = w.fr
    glass = w.room.part(f'door_{fr.key}', fade=fr.key, light='none', shadow=False)
    fr.box(glass, u0, u1, 0, h, -THICK * 0.55, -THICK * 0.5, 'window')
    t = 0.06
    for a, b in ((u0, u0 + t), ((u0 + u1) / 2 - t / 2, (u0 + u1) / 2 + t / 2), (u1 - t, u1)):
        fr.box(w.solid, a, b, 0, h, -THICK * 0.65, -THICK * 0.3, 'frame')
    fr.box(w.solid, u0, u1, h - t, h, -THICK * 0.65, -THICK * 0.3, 'frame')
    for s in (-1, 1):
        um = (u0 + u1) / 2 + s * 0.12
        fr.box(w.props, um - 0.015, um + 0.015, 0.8, 1.4, -THICK * 0.3, 0.04, 'metal')


# ---------------------------------------------------------------------------------------------
# Luz del horneado
# ---------------------------------------------------------------------------------------------
def ceiling(room, hx, hz, height, panels):
    """Techo con luminarias (no se exporta) y una luz de área por luminaria."""
    p = room.part('ceiling', light='none')
    p.box((-hx - THICK, height, -hz - THICK), (hx + THICK, height + 0.1, hz + THICK), 'wall')
    for (x, z, w, d) in panels:
        p.box((x - w / 2, height - 0.02, z - d / 2), (x + w / 2, height, z + d / 2), 'led')
        li = bpy.data.lights.new(f'panel_{room.name}', 'AREA')
        li.shape = 'RECTANGLE'
        li.size, li.size_y = w, d
        li.energy = 70 * w * d / 0.36
        ob = bpy.data.objects.new(li.name, li)
        ob.location = TO_B @ Vector((x, height - 0.03, z))
        room.coll.objects.link(ob)
        room.bake_only.append(ob)
    room.ceiling = p


def sun(room, direction, strength, angle=1.5):
    li = bpy.data.lights.new(f'sol_{room.name}', 'SUN')
    li.energy = strength
    li.angle = math.radians(angle)
    ob = bpy.data.objects.new(li.name, li)
    d = TO_B @ V(direction).normalized()  # dirección en la que viaja la luz
    ob.rotation_euler = Vector((0, 0, -1)).rotation_difference(d).to_euler()
    room.coll.objects.link(ob)
    room.bake_only.append(ob)


def sky_light(w, u0, u1, v0, v1, energy):
    """Luz de cielo: un área al otro lado del ventanal que ilumina hacia dentro."""
    fr = w.fr
    li = bpy.data.lights.new(f'cielo_{w.room.name}', 'AREA')
    li.shape = 'RECTANGLE'
    li.size, li.size_y = u1 - u0, v1 - v0
    li.energy = energy
    ob = bpy.data.objects.new(li.name, li)
    ob.location = TO_B @ fr.p((u0 + u1) / 2, (v0 + v1) / 2, -THICK - 0.3)
    # Ejes locales del área: X a lo largo de la pared, Y vertical, −Z (emisión) hacia la sala.
    ob.rotation_euler = Matrix((TO_B @ -fr.r, TO_B @ UP, TO_B @ -fr.n)).transposed().to_euler()
    w.room.coll.objects.link(ob)
    w.room.bake_only.append(ob)


# ---------------------------------------------------------------------------------------------
# Sala de estación
# ---------------------------------------------------------------------------------------------
def build_station():
    S = L['station']
    h = S['size'] / 2
    H = S['height']
    room = Room('station')
    room.part('floor').grid([-h, h], [-h, h], lambda x, z: 'floor')
    F = {k: WallFrame(k, h, h) for k in ('xp', 'xn', 'zp', 'zn')}

    # zn · pared de espejos con el rótulo (fondo de las vistas frontal e isométrica).
    w = build_wall(room, F['zn'], H)
    for u0, u1 in ((-2.15, -0.79), (-0.68, 0.68), (0.79, 2.15)):
        mirror(w, u0, u1, 0.42, 2.3)
    sign(w, -1.75, 2.48, 0.42)
    led_strip(w, -2.5, 2.5, H - 0.16)

    # xp · ventanales con banco (fondo de las vistas laterales).
    win = [(-2.25, -0.25, 0.95, 2.7), (0.25, 2.25, 0.95, 2.7)]
    w = build_wall(room, F['xp'], H, win)
    for o in win:
        window(w, *o)
        sky_light(w, *o, 200)
    bench(w, -1.6, 1.6, d=0.25)
    plant(w, -2.4, seed=3)

    # zp · almacén de peso libre (fondo de las vistas posteriores).
    w = build_wall(room, F['zp'], H)
    dumbbell_rack(w, -2.35, -0.45)
    plate_tree(w, 0.4)
    kettlebells(w, 1.1, d=0.28)
    med_balls(w, 1.75)
    tv(w, 1.6, 1.75, 1.0)

    # xn · espaldera, cajones, rodillos, reloj y fuente.
    w = build_wall(room, F['xn'], H)
    wall_bars(w, -2.35, -1.3)
    plyo_boxes(w, -0.45)
    foam_rollers(w, 0.7, d=0.16)
    clock(w, 0.75, 2.3)
    water_fountain(w, 1.85)
    plant(w, 2.4, seed=7)

    # Luz: cuatro luminarias sobre la máquina y sol de tarde por los ventanales de xp.
    ceiling(room, h, h, H, [(x, z, 1.2, 0.3) for x in (-1.3, 1.3) for z in (-1.3, 1.3)])
    sun(room, (-1.0, -0.62, 0.35), 1.5)
    return room


# ---------------------------------------------------------------------------------------------
# Gimnasio
# ---------------------------------------------------------------------------------------------
def build_hub():
    Hb = L['hub']
    hx, hz = Hb['floor'][0] / 2, Hb['floor'][1] / 2
    H = Hb['height']
    room = Room('hub')

    # Suelo: pasillos, suelo de cada zona y su línea pintada, en una sola malla.
    INSET, LINE = 0.12, 0.05
    zones = Hb['zones']
    xs, zs = {-hx, hx}, {-hz, hz}
    for r in zones.values():
        for s, e in ((1, r['x'] - r['w'] / 2), (-1, r['x'] + r['w'] / 2)):
            xs |= {e + s * INSET, e + s * (INSET + LINE)}
        for s, e in ((1, r['z'] - r['d'] / 2), (-1, r['z'] + r['d'] / 2)):
            zs |= {e + s * INSET, e + s * (INSET + LINE)}

    def floor_slot(x, z):
        for name, r in zones.items():
            dx = r['w'] / 2 - abs(x - r['x'])
            dz = r['d'] / 2 - abs(z - r['z'])
            if min(dx, dz) > INSET + LINE:
                return f'zone_{name}'
            if min(dx, dz) > INSET:
                return 'line'
        return 'floor'

    room.part('floor').grid(sorted(xs), sorted(zs), floor_slot)
    F = {k: WallFrame(k, hx, hz) for k in ('xp', 'xn', 'zp', 'zn')}

    # zn · pared del fondo: espejos bajo una banda de ventanas altas.
    hi_win = [(-8.6 + 3.1 * i, -6.4 + 3.1 * i, 2.25, 2.95) for i in range(6)]
    w = build_wall(room, F['zn'], H, hi_win)
    for o in hi_win:
        window(w, *o, mullions=1)
        sky_light(w, *o, 120)
    for i in range(10):
        u0 = -8.9 + i * 1.62
        mirror(w, u0, u0 + 1.5, 0.42, 2.05)
    led_strip(w, -9.0, 9.0, 2.12)

    # xp · ventanales grandes hacia la zona de pierna.
    win = [(-5.6, -3.0, 0.9, 2.75), (-2.3, 0.3, 0.9, 2.75), (1.0, 3.6, 0.9, 2.75)]
    w = build_wall(room, F['xp'], H, win)
    for o in win:
        window(w, *o)
        sky_light(w, *o, 300)
    plant(w, -6.0, seed=11)
    plant(w, 5.9, seed=12)

    # zp · fachada de entrada: puerta, rótulo, taquillas, fuente y planta.
    dw = (-2.4, -0.6, 0, 2.25)  # hueco de la puerta (en esta pared u crece hacia −X)
    w = build_wall(room, F['zp'], H, [dw])
    door(w, dw[0], dw[1], dw[3])
    sign(w, -2.25, 2.45, 0.38, sub=None)
    lockers(w, 0.6, 4.2)
    water_fountain(w, -3.3)
    plant(w, -4.3, seed=13)
    tv(w, 2.4, 2.05, 1.2)

    # xn · ventanales y reloj.
    win = [(-4.6, -2.0, 0.9, 2.75), (2.2, 4.8, 0.9, 2.75)]
    w = build_wall(room, F['xn'], H, win)
    for o in win:
        window(w, *o)
        sky_light(w, *o, 300)
    clock(w, 0.1, 2.35)
    plant(w, -5.9, seed=14)
    plant(w, 5.9, seed=15)

    # El atrezo no puede invadir la huella de ninguna máquina (con 15 cm de holgura).
    for p in room.parts:
        if p.name == 'floor':
            continue
        for v in p.bm.verts:
            c = TO_APP @ v.co
            if not 0.01 < c.y < 1.9:
                continue
            for s in Hb['stations']:
                if abs(c.x - s['x']) < s['half'][0] + 0.15 and abs(c.z - s['z']) < s['half'][1] + 0.15:
                    raise SystemExit(f'«{p.name}» invade la máquina {s["id"]} en ({c.x:.2f}, {c.z:.2f})')

    panels = [(x, z, 1.2, 0.3) for x in (-7.2, -3.6, 0.0, 3.6, 7.2) for z in (-3.6, 0.0, 3.6)]
    ceiling(room, hx, hz, H, panels)
    sun(room, (-1.0, -0.6, 0.42), 1.5)
    return room


# ---------------------------------------------------------------------------------------------
# Horneado
# ---------------------------------------------------------------------------------------------
def make_materials(room):
    """Una variante por ranura y modo de luz (el glTF no puede referenciar UV 1 si la malla no la
    tiene): «sala/ranura» (atlas), «sala/ranura~vertex» y «sala/ranura~none»."""
    mats = {}
    for slot, (det, _, col) in SLOTS.items():
        for mode in ('atlas', 'vertex', 'none'):
            m = bpy.data.materials.new(f'{room.name}/{slot}' + ('' if mode == 'atlas' else f'~{mode}'))
            m.use_nodes = True
            bsdf = m.node_tree.nodes['Principled BSDF']
            bsdf.inputs['Base Color'].default_value = (*hex_rgb(col), 1)
            bsdf.inputs['Roughness'].default_value = 0.85
            if slot == 'led':
                bsdf.inputs['Emission Color'].default_value = (1, 0.95, 0.85, 1)
                bsdf.inputs['Emission Strength'].default_value = 6
            if slot == 'mirror':
                bsdf.inputs['Metallic'].default_value = 1
                bsdf.inputs['Roughness'].default_value = 0.05
            m['detail'] = det or ''
            m['mode'] = mode
            mats[slot, mode] = m
    return mats


def select_only(objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def lightmap_uv(room, objs):
    for o in objs:
        o.data.uv_layers.active = o.data.uv_layers['lightmap']
    select_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    margin = 4 / RES[room.name]
    bpy.ops.uv.pack_islands(udim_source='ACTIVE_UDIM', rotate=True, rotate_method='CARDINAL', scale=True, margin_method='FRACTION', margin=margin, shape_method='AABB')
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_pass(objs, image, kind, target='IMAGE_TEXTURES', **kw):
    select_only(objs)
    if image is not None:
        for o in objs:
            for m in o.data.materials:
                nt = m.node_tree
                n = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
                n.name = 'bake_target'
                n.image = image
                uvn = nt.nodes.get('bake_uv') or nt.nodes.new('ShaderNodeUVMap')
                uvn.name = 'bake_uv'
                uvn.uv_map = 'lightmap'
                nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
                nt.nodes.active = n
    bpy.ops.object.bake(type=kind, margin=6, margin_type='EXTEND', use_clear=True, target=target, **kw)


def pixels(image):
    a = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32)
    image.pixels.foreach_get(a)
    return a.reshape(image.size[1], image.size[0], 4)


def guided_denoise(rad, pos, nrm, cover, radius=4, sigma_px=2.5, sigma_pos=0.05):
    """Filtro bilateral cruzado: promedia solo vecinos del atlas que son la misma superficie
    (posición 3D cercana y normal parecida), así no se mezclan islas contiguas."""
    acc = np.zeros_like(rad)
    wsum = np.zeros(rad.shape[:2], dtype=np.float32)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            w_px = math.exp(-(dx * dx + dy * dy) / (2 * sigma_px**2))
            p2 = np.roll(pos, (dy, dx), (0, 1))
            n2 = np.roll(nrm, (dy, dx), (0, 1))
            c2 = np.roll(cover, (dy, dx), (0, 1))
            dp = np.sum((p2 - pos) ** 2, axis=2)
            dn = np.clip(np.sum(n2 * nrm, axis=2), 0, 1) ** 8
            wt = w_px * np.exp(-dp / (2 * sigma_pos**2)) * dn * c2
            acc += np.roll(rad, (dy, dx), (0, 1)) * wt[..., None]
            wsum += wt
    out = acc / np.maximum(wsum, 1e-6)[..., None]
    return np.where(cover[..., None] > 0, out, rad)


def smooth_vertex_light(me):
    """Quita ruido a la luz por vértice: promedia las esquinas que comparten vértice (y normal, si
    la cara es plana) y mezcla con la media de su cara."""
    attr = me.color_attributes['light']
    nl, npoly = len(me.loops), len(me.polygons)
    col = np.empty(nl * 4, np.float32)
    attr.data.foreach_get('color', col)
    col = col.reshape(-1, 4)[:, :3]
    vi = np.empty(nl, np.int64)
    me.loops.foreach_get('vertex_index', vi)
    start = np.empty(npoly, np.int64)
    total = np.empty(npoly, np.int64)
    me.polygons.foreach_get('loop_start', start)
    me.polygons.foreach_get('loop_total', total)
    poly = np.repeat(np.arange(npoly), total)
    pn = np.empty(npoly * 3, np.float32)
    me.polygons.foreach_get('normal', pn)
    smooth = np.empty(npoly, bool)
    me.polygons.foreach_get('use_smooth', smooth)
    qn = np.round(pn.reshape(-1, 3) * 4).astype(np.int64)[poly]
    qn[smooth[poly]] = 99
    key = vi * 1000003 + (qn[:, 0] * 97 + qn[:, 1]) * 97 + qn[:, 2]
    _, inv = np.unique(key, return_inverse=True)
    cnt = np.bincount(inv)
    grp = np.stack([np.bincount(inv, col[:, k]) / cnt for k in range(3)], 1)[inv]
    face = np.stack([np.bincount(poly, col[:, k], minlength=npoly) / total for k in range(3)], 1)[poly]
    return 0.6 * grp + 0.4 * face


def bake_room(room):
    res = RES[room.name]
    atlas = [p.obj for p in room.parts if p.light == 'atlas' and len(p.obj.data.polygons)]
    vertex = [p.obj for p in room.parts if p.light == 'vertex' and len(p.obj.data.polygons)]
    log(room.name, f'{len(atlas)} objetos con atlas ({res}px), {len(vertex)} con luz por vértice, {SAMPLES} muestras')
    lightmap_uv(room, atlas)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 1
    sc.render.bake.use_selected_to_active = False
    sc.render.bake.normal_space = 'OBJECT'
    pos_img = bpy.data.images.new(f'{room.name}_pos', res, res, float_buffer=True)
    nrm_img = bpy.data.images.new(f'{room.name}_nrm', res, res, float_buffer=True)
    bake_pass(atlas, pos_img, 'POSITION')
    bake_pass(atlas, nrm_img, 'NORMAL')
    # Muebles y atrezo de una pared se ocultan con ella: si taparan también la luz rebotada, el
    # suelo de debajo quedaría negro y se vería como una mancha al cortar la pared. Así dan sombra
    # directa (contacto) pero el suelo conserva la luz indirecta.
    for p in room.parts:
        if p.fade and p.name.startswith(('furniture_', 'props_')):
            p.obj.visible_diffuse = False
    sc.cycles.samples = SAMPLES
    sc.cycles.max_bounces = 4
    sc.cycles.diffuse_bounces = 3
    rad_img = bpy.data.images.new(f'{room.name}_rad', res, res, float_buffer=True)
    t = time.time()
    bake_pass(atlas, rad_img, 'DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'})
    log(room.name, f'atlas horneado en {time.time() - t:.0f}s')
    t = time.time()
    bake_pass(vertex, None, 'DIFFUSE', target='VERTEX_COLORS', pass_filter={'DIRECT', 'INDIRECT'})
    log(room.name, f'luz por vértice horneada en {time.time() - t:.0f}s')

    P, N, R = pixels(pos_img), pixels(nrm_img), pixels(rad_img)
    cover = (R[..., 3] > 0.5).astype(np.float32)
    rad = guided_denoise(R[..., :3], P[..., :3], N[..., :3] * 2 - 1, cover)
    # Exposición: la mediana del suelo pasa a 1 (en la app el color del tema es el «iluminado»).
    lum = rad @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    floor = (N[..., 2] * 2 - 1 > 0.9) & (np.abs(P[..., 2]) < 0.01) & (cover > 0)
    ref = float(np.median(lum[floor]))
    # Rango guardado: hasta `headroom` (manchas de sol), codificado en sRGB de 8 bits.
    headroom = float(np.clip(np.percentile(lum[cover > 0] / ref, 99.5), 1.2, 4.0))
    log(room.name, f'referencia {ref:.4f} · rango ×{headroom:.2f} · suelo p10/p90 {np.percentile(lum[floor] / ref, 10):.2f}/{np.percentile(lum[floor] / ref, 90):.2f}')
    out = bpy.data.images.new(f'lightmap_{room.name}', res, res, alpha=False)
    out.colorspace_settings.name = 'sRGB'
    rgba = np.ones((res, res, 4), dtype=np.float32)
    rgba[..., :3] = linear_to_srgb(rad / ref / headroom)
    out.pixels.foreach_set(rgba.ravel())
    out.file_format = 'JPEG'
    out.pack()
    for im in (pos_img, nrm_img, rad_img):
        bpy.data.images.remove(im)
    # Luz por vértice: misma normalización, en lineal (el glTF guarda COLOR_0 en lineal).
    for ob in vertex:
        me = ob.data
        c = smooth_vertex_light(me) / ref / headroom
        rgba = np.ones((len(me.loops), 4), np.float32)
        rgba[:, :3] = np.clip(c, 0, 1)
        me.color_attributes['light'].data.foreach_set('color', rgba.ravel())
    return out, headroom


def export_materials(mats, lightmap, details):
    """Material final: detalle como color base (UV 0) y, si va con atlas, el atlas como emisión (UV 1)."""
    for (slot, mode), m in mats.items():
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.name in ('bake_target', 'bake_uv'):
                nt.nodes.remove(n)
        bsdf = nt.nodes['Principled BSDF']
        if m['detail']:
            tx = nt.nodes.new('ShaderNodeTexImage')
            tx.image = details[m['detail']]
            uv = nt.nodes.new('ShaderNodeUVMap')
            uv.uv_map = 'detail'
            nt.links.new(uv.outputs['UV'], tx.inputs['Vector'])
            nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
        if mode == 'atlas':
            lm = nt.nodes.new('ShaderNodeTexImage')
            lm.image = lightmap
            uv2 = nt.nodes.new('ShaderNodeUVMap')
            uv2.uv_map = 'lightmap'
            nt.links.new(uv2.outputs['UV'], lm.inputs['Vector'])
            nt.links.new(lm.outputs['Color'], bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = 1.0
        else:
            bsdf.inputs['Emission Strength'].default_value = 0.0


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = 'station'
    world = bpy.data.worlds.new('mundo')
    world.color = (0.02, 0.022, 0.025)
    sc.world = world
    details = make_detail_images()
    rooms = [build_station(), build_hub()]
    mats = {}
    for room in rooms:
        mats[room.name] = make_materials(room)
        for p in room.parts:
            p.finish(mats[room.name])
    log('geometría:', ', '.join(f'{r.name} {sum(len(p.obj.data.polygons) for p in r.parts)} caras' for r in rooms))
    ranges = {}
    vl = bpy.context.view_layer
    for room in rooms:
        for other in rooms:
            vl.layer_collection.children[other.coll.name].exclude = other is not room
        lightmap, ranges[room.name] = bake_room(room)
        export_materials(mats[room.name], lightmap, details)
    for room in rooms:
        vl.layer_collection.children[room.coll.name].exclude = False
        empty = [p.obj for p in room.parts if p is not room.ceiling and not len(p.obj.data.polygons)]
        for ob in room.bake_only + [room.ceiling.obj] + empty:
            bpy.data.objects.remove(ob)
    # Una escena glTF por sala; el rango del atlas va en sus `extras`.
    hub_scene = bpy.data.scenes.new('hub')
    hub = next(r for r in rooms if r.name == 'hub')
    sc.collection.children.unlink(hub.coll)
    hub_scene.collection.children.link(hub.coll)
    for room in rooms:
        s = bpy.data.scenes[room.name]
        s['lightRange'] = round(ranges[room.name], 4)
        s['generator'] = 'scripts/environment/build_rooms.py'
    glb = OUT + '.glb'
    bpy.ops.export_scene.gltf(
        filepath=glb,
        export_format='GLB',
        use_active_scene=False,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_vertex_color='ACTIVE',
        export_all_vertex_colors=False,
        export_image_format='JPEG',
        export_jpeg_quality=88,
        export_lights=False,
        export_cameras=False,
        export_apply=True,
    )
    # Sin normales ni UV de detalle que no se usen, y el módulo base64 para la app.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import compact_glb  # noqa: E402

    compact_glb.main(OUT)
    log('exportado', glb, '→', OUT + '.generated.ts')


main()
