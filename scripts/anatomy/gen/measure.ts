/**
 * Mide la piel del modelo generado: perímetros, anchuras y fondos a alturas de referencia, para
 * calibrarla contra medias antropométricas (ANSUR II, aproximadas y escaladas a la talla del
 * modelo). También comprueba las referencias de contacto que usa el motor (espalda y pecho).
 *
 * Uso: npx tsx scripts/anatomy/gen/measure.ts [M|F]
 */
import { Quaternion, Vector3 } from 'three';
import { buildModel, type AnatomyManifest } from '../../../src/anatomy/model';
import { computeSegments, DEFAULT_ANTHRO, type Sex } from '../../../src/engine/anthropometry';
import { MODEL_BODY } from './skeleton';

const sex: Sex = process.argv[2] === 'F' ? 'F' : 'M';
const mod = sex === 'F' ? await import('../../../src/anatomy/data-f.generated') : await import('../../../src/anatomy/data-m.generated');
const manifest = ('ANATOMY_F_MANIFEST' in mod ? mod.ANATOMY_F_MANIFEST : (mod as { ANATOMY_M_MANIFEST: unknown }).ANATOMY_M_MANIFEST) as unknown as AnatomyManifest;
const bin = 'ANATOMY_F_BIN' in mod ? mod.ANATOMY_F_BIN : (mod as { ANATOMY_M_BIN: string }).ANATOMY_M_BIN;
const model = buildModel(manifest, bin);
const P0 = model.skin.getAttribute('position').array as Float32Array;
/** Posiciones de la piel giradas para que `axis` quede vertical (cortes perpendiculares a un segmento). */
function aligned(axis: readonly number[] | null): Float32Array {
  if (!axis) return P0;
  const q = new Quaternion().setFromUnitVectors(new Vector3(...(axis as [number, number, number])).normalize(), new Vector3(0, 1, 0));
  const v = new Vector3();
  const out = new Float32Array(P0.length);
  for (let i = 0; i < P0.length; i += 3) {
    v.set(P0[i]!, P0[i + 1]!, P0[i + 2]!).applyQuaternion(q);
    out[i] = v.x;
    out[i + 1] = v.y;
    out[i + 2] = v.z;
  }
  return out;
}
let P = P0;
const I = model.skin.getIndex()!.array;
const L = manifest.landmarks;
const seg = computeSegments({ ...DEFAULT_ANTHRO, ...MODEL_BODY[sex], sex });
const H = seg.H;

/** Segmentos del corte de la malla con el plano y = h. */
function slice(h: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let t = 0; t < I.length; t += 3) {
    const v = [I[t]!, I[t + 1]!, I[t + 2]!].map((i) => [P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!] as const);
    const pts: Array<[number, number]> = [];
    for (let k = 0; k < 3; k++) {
      const a = v[k]!;
      const b = v[(k + 1) % 3]!;
      if ((a[1] - h) * (b[1] - h) < 0) {
        const s = (h - a[1]) / (b[1] - a[1]);
        pts.push([a[0] + (b[0] - a[0]) * s, a[2] + (b[2] - a[2]) * s]);
      }
    }
    if (pts.length === 2) out.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
  }
  return out;
}

/** Contornos cerrados del corte (segmentos encadenados por sus extremos). */
function loops(h: number): Array<Array<[number, number]>> {
  const segs = slice(h);
  const key = (x: number, z: number) => `${Math.round(x * 1e5)},${Math.round(z * 1e5)}`;
  const adj = new Map<string, number[]>();
  segs.forEach(([ax, az, bx, bz], i) => {
    for (const k of [key(ax, az), key(bx, bz)]) adj.set(k, [...(adj.get(k) ?? []), i]);
  });
  const used = new Uint8Array(segs.length);
  const out: Array<Array<[number, number]>> = [];
  for (let s0 = 0; s0 < segs.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const [ax, az, bx, bz] = segs[s0]!;
    const loop: Array<[number, number]> = [[ax, az], [bx, bz]];
    let end = key(bx, bz);
    for (;;) {
      const next = (adj.get(end) ?? []).find((j) => !used[j]);
      if (next === undefined) break;
      used[next] = 1;
      const [cx, cz, dx, dz] = segs[next]!;
      const far: [number, number] = key(cx, cz) === end ? [dx, dz] : [cx, cz];
      loop.push(far);
      end = key(...far);
    }
    if (loop.length > 8) out.push(loop);
  }
  return out;
}

function inside(poly: Array<[number, number]>, x: number, z: number) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

/** Perímetro y extensión del contorno que contiene (x, z). */
function measure(h: number, x: number, z: number) {
  const all = loops(h);
  const poly = all.find((l) => inside(l, x, z)) ?? [];
  if (process.env.DEBUG) console.log(`    ${all.length} contornos a ${h.toFixed(3)}`);
  let per = 0;
  let xmin = Infinity;
  let xmax = -Infinity;
  let zmin = Infinity;
  let zmax = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]!;
    const [bx, bz] = poly[(i + 1) % poly.length]!;
    per += Math.hypot(bx - ax, bz - az);
    xmin = Math.min(xmin, ax);
    xmax = Math.max(xmax, ax);
    zmin = Math.min(zmin, az);
    zmax = Math.max(zmax, az);
  }
  return { per, width: xmax - xmin, zmin, zmax };
}

const k = H / (sex === 'F' ? 1.628 : 1.756);
const T = (m: number, f: number) => (sex === 'F' ? f : m) * k;
const c7y = L.c7![1]!;
const yHip = L.hjc![1]!;
const mid = (a: readonly number[], b: readonly number[], t: number) => [a[0]! + (b[0]! - a[0]!) * t, a[2]! + (b[2]! - a[2]!) * t] as const;
const knee = L.knee!;
const ankle = L.ankle!;
const gh = L.gh!;
const elbow = L.elbow!;
const wrist = L.wrist!;
const hjc = L.hjc!;
const rows: Array<[string, number, readonly [number, number], number]> = [
  ['cuello', c7y + 0.03 * H, [0, L.c7![2]! + 0.03 * H], T(0.39, 0.32)],
  ['pecho', c7y - 0.12 * H, [0, 0], T(1.02, 0.92)],
  ['cintura', yHip + 0.105 * H, [0, 0], T(0.88, 0.76)],
  ['cadera', yHip - 0.025 * H, [0, 0], T(1.0, 1.02)],
  ['muslo', yHip - 0.08 * H, mid(hjc, knee, 0.15), T(0.6, 0.6)],
  ['gemelo', knee[1]! - 0.3 * (knee[1]! - ankle[1]!), mid(knee, ankle, 0.3), T(0.385, 0.365)],
  ['brazo', gh[1]! - 0.6 * (gh[1]! - elbow[1]!), mid(gh, elbow, 0.6), T(0.32, 0.28)],
  ['antebrazo', elbow[1]! - 0.25 * (elbow[1]! - wrist[1]!), mid(elbow, wrist, 0.25), T(0.285, 0.245)],
];
console.log(`${sex} · talla del modelo ${(L.top![1]! * 100).toFixed(1)} cm`);
/** Corte perpendicular a un segmento a la fracción t entre dos puntos. */
function limbCut(a: readonly number[], b: readonly number[], t: number) {
  const axis = [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
  P = aligned(axis);
  const q = new Quaternion().setFromUnitVectors(new Vector3(...(axis as [number, number, number])).normalize(), new Vector3(0, 1, 0));
  const c = new Vector3(a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t).applyQuaternion(q);
  return { y: c.y, x: c.x, z: c.z };
}
const LIMBS: Record<string, [readonly number[], readonly number[], number]> = {
  muslo: [L.hjc!, L.knee!, 0.3],
  gemelo: [L.knee!, L.ankle!, 0.3],
  brazo: [L.gh!, L.elbow!, 0.6],
  antebrazo: [L.elbow!, L.wrist!, 0.25],
};
for (const [name, y0, [x0, z0], target] of rows) {
  const limbRow = LIMBS[name];
  let y = y0;
  let x = x0;
  let z = z0;
  if (limbRow) ({ y, x, z } = limbCut(...limbRow));
  else P = P0;
  const m = measure(y, x, z);
  const d = ((m.per / target - 1) * 100).toFixed(0);
  console.log(`  ${name.padEnd(10)} perímetro ${(m.per * 100).toFixed(1).padStart(5)} cm (objetivo ${(target * 100).toFixed(0)}, ${+d >= 0 ? '+' : ''}${d} %)  ancho ${(m.width * 100).toFixed(1)}  fondo ${((m.zmax - m.zmin) * 100).toFixed(1)} [${(m.zmin * 100).toFixed(1)}, ${(m.zmax * 100).toFixed(1)}]`);
}
// Referencias de contacto del motor (src/stations/common.ts): espalda alta y pecho.
const backY = L.l1![1]! + 0.62 * seg.thoracic;
P = P0;
const back = measure(backY, 0, 0);
console.log(`  espalda alta: piel en z ${(back.zmin * 100).toFixed(1)} cm; el motor supone ${((L.s1![2]! - 0.022 * H) * 100).toFixed(1)} cm`);
const chestY = L.l1![1]! + 0.5 * seg.thoracic;
const chest = measure(chestY, 0, 0);
console.log(`  pecho (esternón): piel en z ${(chest.zmax * 100).toFixed(1)} cm; el motor supone ${((L.s1![2]! + 0.118 * H) * 100).toFixed(1)} cm`);
