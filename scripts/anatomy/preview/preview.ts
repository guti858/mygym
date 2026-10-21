/**
 * Vista previa del modelo anatómico en reposo (herramienta de desarrollo, no entra en la app):
 * cuatro vistas ortográficas (frente, perfil, espalda y tres cuartos) con los materiales reales.
 * Parámetros: ?sex=M|F, ?skin=0|1|solid, ?zoom=torso|legs|head|hand, ?act=<grupo,grupo>.
 */
import { AmbientLight, Bone, DetachedBindMode, DirectionalLight, Matrix4, Mesh, OrthographicCamera, Scene, Skeleton, SkinnedMesh, Vector3, WebGLRenderer } from 'three';
import { boneMatrix, solveRig } from '../../../src/anatomy/rig';
import { ANTHRO_TEST_PROFILES, computeSegments, DEFAULT_ANTHRO } from '../../../src/engine/anthropometry';
import { evaluateFrame } from '../../../src/engine/evaluate';
import { STATION_MODULES } from '../../../src/stations/modules';
import { buildModel, type AnatomyManifest } from '../../../src/anatomy/model';
import { createBodyMaterial, createSkinMaterial, setLinear } from '../../../src/anatomy/materials';
import { PALETTES } from '../../../src/scene/palette';

const q = new URLSearchParams(location.search);
const sex = q.get('sex') === 'F' ? 'F' : 'M';
const mod = sex === 'F' ? await import('../../../src/anatomy/data-f.generated') : await import('../../../src/anatomy/data-m.generated');
const manifest = (('ANATOMY_F_MANIFEST' in mod ? mod.ANATOMY_F_MANIFEST : (mod as { ANATOMY_M_MANIFEST: unknown }).ANATOMY_M_MANIFEST) as unknown) as AnatomyManifest;
const bin = 'ANATOMY_F_BIN' in mod ? mod.ANATOMY_F_BIN : (mod as { ANATOMY_M_BIN: string }).ANATOMY_M_BIN;
// ?only=<texto,texto>: solo las piezas cuyo nombre o grupo contiene alguno (más la capa profunda).
const only = (q.get('only') ?? '').split(',').filter(Boolean);
const model = buildModel(
  only.length ? { ...manifest, objects: manifest.objects.filter((o) => o.group === 'profundo' || only.some((t) => o.name.includes(t) || o.group.includes(t))) } : manifest,
  bin,
);
const pal = PALETTES[(q.get('theme') as 'claro') ?? 'claro'] ?? PALETTES.claro;

const body = createBodyMaterial();
const skin = createSkinMaterial();
const active = new Set((q.get('act') ?? '').split(',').filter(Boolean));
const finish: Record<string, [string, number]> = {
  otros: [pal.anatomy.muscle, 0.55],
  tendon: [pal.anatomy.tendon, 0.4],
  hueso: [pal.anatomy.bone, 0.7],
  profundo: [pal.anatomy.deep, 0.75],
  guante: [pal.anatomy.glove, 0.85],
  calzado: [pal.anatomy.shoe, 0.6],
  pelo: [pal.anatomy.hair, 0.9],
  ojo: [pal.anatomy.eye, 0.25],
  iris: [pal.anatomy.iris, 0.3],
};
model.regions.forEach((g, i) => {
  const f = finish[g];
  const c = active.has(g) ? pal.muscle.principal : f ? f[0] : pal.anatomy.muscle;
  setLinear(body.uniforms.color[i]!, c);
  body.uniforms.fx[i]!.y = f ? f[1] : 0.5;
  if (active.has(g)) setLinear(body.uniforms.glow[i]!, pal.muscle.principal, 0.12);
});
setLinear(new Vector3(), pal.anatomy.skin);
skin.material.color.set(pal.anatomy.skin);
const skinMode = q.get('skin') ?? '1';
skin.uniforms.solid.value = skinMode === 'solid' ? 1 : 0;
if (skinMode === 'solid') skin.material.depthWrite = true;

const W = 1600;
const Hpx = 900;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, Hpx);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
const scene = new Scene();
scene.add(new AmbientLight('#ffffff', 1.1));
const sun = new DirectionalLight('#ffffff', 2.2);
sun.position.set(1.5, 3, 2.5);
scene.add(sun);
const back = new DirectionalLight('#ffffff', 0.8);
back.position.set(-2, 1.5, -2.5);
scene.add(back);
// ?station=<id>&p=0..1&v=<variante>&err=<error>: el cuerpo posado por el motor y el rig.
const stationId = q.get('station');
let center = new Vector3(0, 0, 0);
let span = 0;
if (stationId) {
  const mod = STATION_MODULES[stationId]!;
  const anthro = { ...(ANTHRO_TEST_PROFILES[q.get('perfil') ?? (sex === 'F' ? 'mujer' : 'p50')] ?? DEFAULT_ANTHRO), sex: sex as 'M' | 'F' };
  const r = evaluateFrame(mod.logic, mod.content, { anthro, seg: computeSegments(anthro), variantId: q.get('v') ?? mod.content.variants[0]!.id, errorId: q.get('err'), loadKg: mod.logic.defaultLoadKg, p: Number(q.get('p') ?? 0.5), phase: 'concentrica' });
  const xfs = solveRig({ landmarks: manifest.landmarks, bones: manifest.bones }, r.body);
  const bones = manifest.bones.map((n) => {
    const b = new Bone();
    b.matrixAutoUpdate = false;
    b.matrixWorldAutoUpdate = false;
    boneMatrix(xfs.get(n)!, b.matrixWorld);
    return b;
  });
  const skel = new Skeleton(bones, bones.map(() => new Matrix4()));
  for (const [geo, mat] of [[model.body, body.material], [model.skin, skin.material]] as const) {
    if (mat === skin.material && skinMode === '0') continue;
    const m = new SkinnedMesh(geo, mat);
    m.bindMode = DetachedBindMode;
    m.bind(skel, new Matrix4());
    m.frustumCulled = false;
    scene.add(m);
  }
  const pts = [r.body.head, r.body.pelvis.origin, ...(['L', 'R'] as const).flatMap((sd) => [r.body.arms[sd].grip, r.body.arms[sd].elbow, r.body.legs[sd].toe, r.body.legs[sd].heel, r.body.legs[sd].knee])];
  const lo = pts.reduce((a, b) => a.clone().min(b));
  const hi = pts.reduce((a, b) => a.clone().max(b));
  center = lo.clone().add(hi).multiplyScalar(0.5);
  span = hi.clone().sub(lo).length() * 0.62 + 0.1;
} else {
  scene.add(new Mesh(model.body, body.material));
  if (skinMode !== '0') scene.add(new Mesh(model.skin, skin.material));
}

const zoom = q.get('zoom');
const top = manifest.landmarks.top![1]!;
const frame: Record<string, [number, number]> = { torso: [top * 0.52, top * 1.0], legs: [0, top * 0.58], head: [top * 0.8, top * 1.02], hand: [top * 0.36, top * 0.56] };
const [y0, y1] = span ? [center.y - span, center.y + span] : zoom && frame[zoom] ? frame[zoom] : [-0.02, top + 0.03];
const views: Array<[number, string]> = [
  [0, 'frente'],
  [90, 'perfil'],
  [180, 'espalda'],
  [35, 'tres cuartos'],
];
const vw = W / views.length;
views.forEach(([az], i) => {
  const hh = (y1 - y0) / 2;
  const hw = (hh * vw) / Hpx;
  const cam = new OrthographicCamera(-hw, hw, hh, -hh, 0.01, 20);
  const a = (az * Math.PI) / 180;
  const cx = span ? center.x : zoom === 'hand' ? 0.25 : 0;
  const cz = span ? center.z : 0;
  cam.position.set(cx + Math.sin(a) * 5, (y0 + y1) / 2, cz + Math.cos(a) * 5);
  cam.lookAt(cx, (y0 + y1) / 2, cz);
  renderer.setViewport(i * vw, 0, vw, Hpx);
  renderer.setScissor(i * vw, 0, vw, Hpx);
  renderer.setClearColor('#e9e6df');
  renderer.render(scene, cam);
});
document.title = 'listo';
