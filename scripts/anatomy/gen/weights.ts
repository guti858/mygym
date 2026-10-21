import type { Skeleton } from './skeleton';
import { add, capsule, ellipsoid, roundBox, roundCone, scale, smoothstep, sphere, sub, type Shape, type V3 } from './sdf';

/**
 * Pesos de skinning respecto a los huesos del rig del motor (mismo orden y nombres que
 * src/anatomy/rig.ts). Cada vértice se reparte entre los huesos más cercanos (distancia a formas
 * óseas propias del esqueleto generado), se suaviza sobre la malla y, donde dos huesos vecinos se
 * reparten un vértice, entra el hueso auxiliar de medio giro de esa articulación (conserva volumen).
 * El tronco cuenta como un único «hueso axial» frente a los miembros y después se reparte entre
 * pelvis, lumbar, tórax y cuello según la altura (la columna se dobla de forma continua).
 */

export const AXIAL = ['pelvis', 'lumbar', 'thorax', 'neck'] as const;
export const AXIAL_HELPERS = ['h_s1', 'h_l1', 'h_c7'] as const;
export const SIDED = ['girdle', 'humerus', 'fa0', 'fa1', 'fa2', 'fa3', 'hand', 'i1', 'i2', 'i3', 'm1', 'm2', 'm3', 'r1', 'r2', 'r3', 'p1', 'p2', 'p3', 't1', 't2', 'thigh', 'shank', 'foot'] as const;
export const SIDED_HELPERS = ['h_sc', 'h_gh', 'h_th', 'h_el', 'h_wr', 'h_hip', 'h_kn', 'h_an'] as const;
export const BONES: string[] = [...AXIAL, ...AXIAL_HELPERS, ...[...SIDED, ...SIDED_HELPERS].map((b) => `${b}.L`), ...[...SIDED, ...SIDED_HELPERS].map((b) => `${b}.R`)];
export const BI = new Map(BONES.map((b, i) => [b, i]));

const PAIRS_L: Array<[string, string, string]> = [
  ['thorax', 'girdle', 'h_sc'],
  ['girdle', 'humerus', 'h_gh'],
  ['thorax', 'humerus', 'h_th'],
  ['humerus', 'fa0', 'h_el'],
  ['fa3', 'hand', 'h_wr'],
  ['pelvis', 'thigh', 'h_hip'],
  ['thigh', 'shank', 'h_kn'],
  ['shank', 'foot', 'h_an'],
];
export const HELPER_PAIRS = new Map<string, string>([
  ['pelvis|lumbar', 'h_s1'],
  ['lumbar|thorax', 'h_l1'],
  ['thorax|neck', 'h_c7'],
]);
for (const side of ['L', 'R']) {
  for (const [a, b, h] of PAIRS_L) {
    const n = (x: string) => (AXIAL.includes(x as (typeof AXIAL)[number]) ? x : `${x}.${side}`);
    HELPER_PAIRS.set(`${n(a)}|${n(b)}`, `${h}.${side}`);
  }
}

/** Formas óseas de anclaje por hueso (lado izquierdo; el derecho se refleja). «axial» = tronco. */
export function anchors(sk: Skeleton): Map<string, Shape[]> {
  const { H, L, p, hand, fingers } = sk;
  const F = sk.sex === 'F';
  const c7y = L.c7![1];
  const yHip = L.hjc![1];
  const left = new Map<string, Shape[]>();
  const put = (b: string, ...s: Shape[]) => left.set(b, [...(left.get(b) ?? []), ...s]);
  put('girdle', capsule(L.sc!, p.acromion!, 0.006 * H), ellipsoid(add(scale(add(p.scapSpineRoot!, p.scapInfAngle!), 0.5), [0.012 * H, 0.004 * H, 0]), [0.03 * H, 0.055 * H, 0.008 * H]), sphere(p.acromion!, 0.008 * H));
  put('humerus', roundCone(L.gh!, L.elbow!, 0.011 * H, 0.009 * H), sphere(L.gh!, 0.015 * H));
  put('forearm', roundCone(L.elbow!, L.wrist!, 0.009 * H, 0.007 * H));
  const m0 = L.m0!;
  put('hand', roundBox(scale(add(L.wrist!, m0), 0.5), [0.02 * H, 0.5 * Math.hypot(...sub(m0, L.wrist!)), 0.006 * H], 0.004 * H, [hand.radial, hand.axis, hand.palm]), capsule(fingers.t.pts[0]!, fingers.t.pts[1]!, 0.004 * H));
  for (const f of ['i', 'm', 'r', 'p'] as const) {
    const pts = fingers[f].pts;
    for (let j = 0; j < 3; j++) put(`${f}${j + 1}`, capsule(pts[j]!, pts[j + 1]!, 0.0025 * H));
  }
  put('t1', capsule(fingers.t.pts[1]!, fingers.t.pts[2]!, 0.003 * H));
  put('t2', capsule(fingers.t.pts[2]!, fingers.t.pts[3]!, 0.003 * H));
  put('thigh', roundCone(L.hjc!, L.knee!, 0.012 * H, 0.012 * H), sphere(p.trochanter!, 0.012 * H));
  put('h_kn', ellipsoid(p.patella!, [0.012 * H, 0.014 * H, 0.006 * H]));
  put('shank', roundCone(L.knee!, L.ankle!, 0.013 * H, 0.009 * H));
  put('foot', capsule(L.heel!, p.ball!, 0.01 * H), capsule(p.ball!, L.toe!, 0.008 * H), sphere(p.calcaneus!, 0.016 * H));

  const out = new Map<string, Shape[]>();
  const mirrorShape = (s: Shape): Shape => ({ f: (x, y, z) => s.f(-x, y, z), lo: [-s.hi[0], s.lo[1], s.lo[2]], hi: [-s.lo[0], s.hi[1], s.hi[2]] });
  for (const [b, shapes] of left) {
    out.set(`${b}.L`, shapes);
    out.set(`${b}.R`, shapes.map(mirrorShape));
  }
  const headC = p.headC!;
  out.set('axial', [
    ellipsoid([0, yHip + 0.03 * H, -0.018 * H], [0.05 * H * (F ? 1.1 : 1), 0.04 * H, 0.04 * H]),
    capsule(L.s1!, [0, c7y, L.c7![2] + 0.012 * H], 0.012 * H),
    ellipsoid([0, c7y - 0.06 * H, 0], [0.05 * H, 0.05 * H, 0.038 * H]),
    ellipsoid([0, c7y - 0.13 * H, 0.004 * H], [0.064 * H, 0.072 * H, 0.044 * H]),
    capsule(L.c7!, add(headC, [0, -0.04 * H, -0.006 * H]), 0.012 * H),
    ellipsoid(headC, [0.035 * H, 0.045 * H, 0.045 * H]),
  ]);
  return out;
}

export interface WeightOpts {
  sigma: number;
  /** Huesos candidatos (claves de anchors(): «axial», «humerus.L»...); por defecto, todos los del lado. */
  allowed?: readonly string[];
  /** Solo el lado izquierdo (pieza que se refleja) o los dos (pieza entera). */
  both: boolean;
  /** Todo a un hueso. */
  rigid?: string;
}

/** Pesos crudos (n × huesos). */
export function computeWeights(sk: Skeleton, anc: Map<string, Shape[]>, P: Float32Array, T: Uint32Array, o: WeightOpts): Float32Array {
  const n = P.length / 3;
  const B = BONES.length;
  const W = new Float32Array(n * B);
  const { H, L } = sk;
  const s1y = L.s1![1];
  const l1y = L.l1![1];
  const c7y = L.c7![1];
  const axialSplit = (y: number) => {
    const a1 = smoothstep(s1y - 0.025 * H, s1y + 0.025 * H, y);
    const a2 = smoothstep(l1y - 0.03 * H, l1y + 0.03 * H, y);
    const a3 = smoothstep(c7y - 0.008 * H, c7y + 0.03 * H, y);
    return [1 - a1, a1 * (1 - a2), a2 * (1 - a3), a3];
  };
  if (o.rigid) {
    for (let i = 0; i < n; i++) W[i * B + BI.get(o.rigid)!] = 1;
    return W;
  }
  const keys = [...anc.keys()].filter((k) => (o.allowed ? o.allowed.includes(k) : k === 'axial' || o.both || k.endsWith('.L')));
  const K = keys.length;
  const D = new Float32Array(n * K);
  for (let i = 0; i < n; i++) {
    const x = P[i * 3]!;
    const y = P[i * 3 + 1]!;
    const z = P[i * 3 + 2]!;
    for (let k = 0; k < K; k++) {
      let d = Infinity;
      for (const s of anc.get(keys[k]!)!) {
        // Poda por caja: lejos de la forma la distancia exacta no importa.
        const gx = Math.max(s.lo[0] - x, 0, x - s.hi[0]);
        const gy = Math.max(s.lo[1] - y, 0, y - s.hi[1]);
        const gz = Math.max(s.lo[2] - z, 0, z - s.hi[2]);
        if (gx * gx + gy * gy + gz * gz > 0.25 * 0.25) continue;
        d = Math.min(d, Math.max(0, s.f(x, y, z)));
      }
      D[i * K + k] = d;
    }
  }
  // Pesos por proximidad relativa.
  const Wk = new Float32Array(n * K);
  for (let i = 0; i < n; i++) {
    let dmin = Infinity;
    for (let k = 0; k < K; k++) dmin = Math.min(dmin, D[i * K + k]!);
    let s = 0;
    for (let k = 0; k < K; k++) {
      const e = D[i * K + k]! - dmin;
      const w = e > 5 * o.sigma || !Number.isFinite(e) ? 0 : Math.exp(-e / o.sigma);
      Wk[i * K + k] = w;
      s += w;
    }
    for (let k = 0; k < K; k++) Wk[i * K + k]! /= s || 1;
  }
  // Suavizado laplaciano sobre la malla (3 pasadas).
  const nbS = new Float32Array(n * K);
  const cnt = new Float32Array(n);
  for (let it = 0; it < 3; it++) {
    nbS.fill(0);
    cnt.fill(0);
    for (let t = 0; t < T.length; t += 3) {
      for (const [a, b] of [[T[t]!, T[t + 1]!], [T[t + 1]!, T[t + 2]!], [T[t + 2]!, T[t]!]] as const) {
        for (let k = 0; k < K; k++) {
          nbS[a * K + k]! += Wk[b * K + k]!;
          nbS[b * K + k]! += Wk[a * K + k]!;
        }
        cnt[a]!++;
        cnt[b]!++;
      }
    }
    for (let i = 0; i < n; i++) {
      if (!cnt[i]) continue;
      for (let k = 0; k < K; k++) Wk[i * K + k] = 0.5 * Wk[i * K + k]! + (0.5 * nbS[i * K + k]!) / cnt[i]!;
    }
  }
  // A huesos del rig: tronco por altura y antebrazo en 4 bandas de pronosupinación.
  for (let i = 0; i < n; i++) {
    const x = P[i * 3]!;
    const y = P[i * 3 + 1]!;
    const z = P[i * 3 + 2]!;
    for (let k = 0; k < K; k++) {
      const w = Wk[i * K + k]!;
      if (w <= 0) continue;
      const key = keys[k]!;
      if (key === 'axial') {
        const a = axialSplit(y);
        AXIAL.forEach((b, j) => (W[i * B + BI.get(b)!]! += w * a[j]!));
      } else if (key.startsWith('forearm.')) {
        const side = key.slice(-1);
        const s = side === 'L' ? 1 : -1;
        const e = L.elbow!;
        const wr = L.wrist!;
        const f: V3 = sub(wr, e);
        const q: V3 = [s * x - e[0], y - e[1], z - e[2]];
        const t = Math.min(1, Math.max(0, (q[0] * f[0] + q[1] * f[1] + q[2] * f[2]) / (f[0] ** 2 + f[1] ** 2 + f[2] ** 2))) * 3;
        for (let b = 0; b < 4; b++) W[i * B + BI.get(`fa${b}.${side}`)!]! += w * Math.max(0, 1 - Math.abs(t - b));
      } else {
        W[i * B + BI.get(key)!]! += w;
      }
    }
  }
  return W;
}

/** Huesos auxiliares de medio giro, 4 influencias por vértice y cuantización a 8 bits. */
export function finalize(W: Float32Array, n: number): { idx: Uint8Array; w: Uint8Array } {
  const B = BONES.length;
  const idx = new Uint8Array(n * 4);
  const wq = new Uint8Array(n * 4);
  const row = new Float64Array(B);
  for (let i = 0; i < n; i++) {
    for (let b = 0; b < B; b++) row[b] = W[i * B + b]!;
    const order = [...row.keys()].sort((a, b) => row[b]! - row[a]!);
    const a = order[0]!;
    const b = order[1]!;
    if (row[b]! > 0) {
      const ka = `${BONES[a]}|${BONES[b]}`;
      const kb = `${BONES[b]}|${BONES[a]}`;
      const key = HELPER_PAIRS.has(ka) ? ka : HELPER_PAIRS.has(kb) ? kb : null;
      if (key) {
        const h = HELPER_PAIRS.get(key)!;
        const [first] = key.split('|');
        const pa = BONES[a] === first ? a : b;
        const pb = pa === a ? b : a;
        const s = row[a]! + row[b]!;
        const u = row[pb]! / s;
        row[pa] = s * Math.max(0, 1 - 2 * u);
        row[pb] = s * Math.max(0, 2 * u - 1);
        row[BI.get(h)!]! += s * (1 - Math.abs(2 * u - 1));
      }
    }
    const top = [...row.keys()].sort((x, y) => row[y]! - row[x]!).slice(0, 4);
    let s = 0;
    for (const t of top) s += row[t]!;
    const q = top.map((t) => Math.floor((row[t]! / (s || 1)) * 255 + 0.5));
    q[0]! += 255 - q.reduce((x, y) => x + y, 0);
    for (let k = 0; k < 4; k++) {
      idx[i * 4 + k] = top[k]!;
      wq[i * 4 + k] = Math.max(0, q[k]!);
    }
  }
  return { idx, w: wq };
}
