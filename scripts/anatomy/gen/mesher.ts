import { MeshoptSimplifier } from 'meshoptimizer';
import type { Field, V3 } from './sdf';

/** Malla indexada en bruto (triángulos). */
export interface Mesh {
  P: Float32Array;
  T: Uint32Array;
}

/**
 * Surface nets: un vértice por celda que corta la isosuperficie (media de los cruces de sus
 * aristas) y un cuadrilátero por arista de la rejilla con cambio de signo. Malla estanca y
 * regular, sin tablas de casos.
 */
export function surfaceNets(f: Field, lo: V3, hi: V3, h: number): Mesh {
  const nx = Math.ceil((hi[0] - lo[0]) / h) + 1;
  const ny = Math.ceil((hi[1] - lo[1]) / h) + 1;
  const nz = Math.ceil((hi[2] - lo[2]) / h) + 1;
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const val = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    val[idx(i, j, k)] = f(lo[0] + i * h, lo[1] + j * h, lo[2] + k * h);
  }
  // Vértice por celda (celda (i,j,k) = cubo entre nodos i..i+1, j..j+1, k..k+1).
  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => (k * (ny - 1) + j) * (nx - 1) + i;
  const P: number[] = [];
  const corner = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ] as const;
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  const v = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) {
      const [a, b, d] = corner[c]!;
      v[c] = val[idx(i + a, j + b, k + d)]!;
      if (v[c]! < 0) inside++;
    }
    if (inside === 0 || inside === 8) continue;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    for (const [e0, e1] of edges) {
      const a = v[e0]!;
      const b = v[e1]!;
      if (a < 0 === b < 0) continue;
      const t = a / (a - b);
      const c0 = corner[e0]!;
      const c1 = corner[e1]!;
      sx += c0[0] + (c1[0] - c0[0]) * t;
      sy += c0[1] + (c1[1] - c0[1]) * t;
      sz += c0[2] + (c1[2] - c0[2]) * t;
      n++;
    }
    cellVert[cidx(i, j, k)] = P.length / 3;
    P.push(lo[0] + (i + sx / n) * h, lo[1] + (j + sy / n) * h, lo[2] + (k + sz / n) * h);
  }
  const T: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) T.push(a, c, b, a, d, c);
    else T.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    // Arista en X entre (i,j,k) y (i+1,j,k): celdas vecinas en j-1..j, k-1..k.
    const a = val[idx(i, j, k)]! < 0;
    if (a === val[idx(i + 1, j, k)]! < 0) continue;
    quad(cellVert[cidx(i, j - 1, k - 1)]!, cellVert[cidx(i, j, k - 1)]!, cellVert[cidx(i, j, k)]!, cellVert[cidx(i, j - 1, k)]!, !a);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = val[idx(i, j, k)]! < 0;
    if (a === val[idx(i, j + 1, k)]! < 0) continue;
    quad(cellVert[cidx(i - 1, j, k - 1)]!, cellVert[cidx(i - 1, j, k)]!, cellVert[cidx(i, j, k)]!, cellVert[cidx(i, j, k - 1)]!, !a);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = val[idx(i, j, k)]! < 0;
    if (a === val[idx(i, j, k + 1)]! < 0) continue;
    quad(cellVert[cidx(i - 1, j - 1, k)]!, cellVert[cidx(i, j - 1, k)]!, cellVert[cidx(i, j, k)]!, cellVert[cidx(i - 1, j, k)]!, !a);
  }
  return { P: Float32Array.from(P), T: Uint32Array.from(T) };
}

/** Vecinos por vértice (aristas de los triángulos). */
export function neighbors(n: number, T: Uint32Array): number[][] {
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t]!;
    const b = T[t + 1]!;
    const c = T[t + 2]!;
    nb[a]!.add(b).add(c);
    nb[b]!.add(a).add(c);
    nb[c]!.add(a).add(b);
  }
  return nb.map((s) => [...s]);
}

/** Suavizado de Taubin (λ/μ): alisa sin encoger. */
export function taubin(m: Mesh, iters = 6, lambda = 0.5, mu = -0.53): Mesh {
  const n = m.P.length / 3;
  const nb = neighbors(n, m.T);
  let P = Float32Array.from(m.P);
  const step = (k: number) => {
    const Q = Float32Array.from(P);
    for (let i = 0; i < n; i++) {
      const list = nb[i]!;
      if (!list.length) continue;
      let x = 0;
      let y = 0;
      let z = 0;
      for (const j of list) {
        x += P[j * 3]!;
        y += P[j * 3 + 1]!;
        z += P[j * 3 + 2]!;
      }
      const c = list.length;
      Q[i * 3] = P[i * 3]! + k * (x / c - P[i * 3]!);
      Q[i * 3 + 1] = P[i * 3 + 1]! + k * (y / c - P[i * 3 + 1]!);
      Q[i * 3 + 2] = P[i * 3 + 2]! + k * (z / c - P[i * 3 + 2]!);
    }
    P = Q;
  };
  for (let i = 0; i < iters; i++) {
    step(lambda);
    step(mu);
  }
  return { P, T: m.T };
}

/** Quita vértices sin triángulos y renumera. */
export function compact(m: Mesh): Mesh {
  const n = m.P.length / 3;
  const map = new Int32Array(n).fill(-1);
  let c = 0;
  for (const i of m.T) if (map[i] === -1) map[i] = c++;
  const P = new Float32Array(c * 3);
  for (let i = 0; i < n; i++) {
    const j = map[i]!;
    if (j < 0) continue;
    P[j * 3] = m.P[i * 3]!;
    P[j * 3 + 1] = m.P[i * 3 + 1]!;
    P[j * 3 + 2] = m.P[i * 3 + 2]!;
  }
  return { P, T: Uint32Array.from(m.T, (i) => map[i]!) };
}

/**
 * Simplificación por error cuadrático (meshoptimizer) hasta `targetTris` triángulos o un error
 * relativo `maxError` (fracción del tamaño de la malla), lo que llegue antes.
 */
export async function simplify(m: Mesh, targetTris: number, maxError = 0.004): Promise<Mesh> {
  await MeshoptSimplifier.ready;
  if (m.T.length / 3 <= targetTris) return m;
  const [T] = MeshoptSimplifier.simplify(m.T, m.P, 3, targetTris * 3, maxError, []);
  return compact({ P: m.P, T });
}

export function area(m: Mesh): number {
  let s = 0;
  const P = m.P;
  for (let t = 0; t < m.T.length; t += 3) {
    const a = m.T[t]! * 3;
    const b = m.T[t + 1]! * 3;
    const c = m.T[t + 2]! * 3;
    const ux = P[b]! - P[a]!;
    const uy = P[b + 1]! - P[a + 1]!;
    const uz = P[b + 2]! - P[a + 2]!;
    const vx = P[c]! - P[a]!;
    const vy = P[c + 1]! - P[a + 1]!;
    const vz = P[c + 2]! - P[a + 2]!;
    s += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return s;
}
