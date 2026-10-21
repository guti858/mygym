import { add, clamp, cross, dot, gradient, len, lerp3, norm, project, scale, sphere, sub, type Field, type Shape, type V3 } from './sdf';

/**
 * Músculo como lámina de fibras con grosor: una superficie media P(u, v) (u a lo ancho, v del
 * origen a la inserción) que se apoya sobre la capa de debajo, y una sección elíptica de semigrosor
 * h(u, v) a cada lado de esa superficie. Se malla como un tubo de cuadriláteros cerrado (un anillo por
 * cada v) con tapas en los extremos. Las porciones tendinosas (cerca del origen o de la inserción)
 * salen como una pieza aparte con el mismo contorno.
 */

/** Estación a lo largo del músculo: polilínea transversal o centro + anchura. */
export type Station = { pts: readonly V3[] } | { c: V3; w: number };

export interface MuscleDef {
  name: string;
  group: string;
  /** Capa: se apoya sobre el núcleo y las capas inferiores ya generadas. */
  layer: number;
  stations: readonly Station[];
  /** Semigrosor (m) por estación, o pares [v, h] a trozos. */
  h: readonly number[] | ReadonlyArray<readonly [number, number]>;
  /** 0–1 por estación: 1 = pegado a la capa de debajo, 0 = libre (salva un hueco). */
  wrap?: readonly number[];
  /** Separación extra sobre la capa de debajo (m). */
  depth?: number;
  /** Puntos a lo ancho (lado de la sección) y a lo largo. */
  N?: number;
  M?: number;
  /** Exponente del perfil transversal: 0,5 = elipse; menor = más plano. */
  pow?: number;
  /** Tendón: v por debajo de t[0] y por encima de t[1]. */
  tendon?: readonly [number, number];
  /** Pieza simétrica del lado izquierdo (se refleja); false para la línea media. */
  mirror?: boolean;
}

export interface LoftMesh {
  name: string;
  group: string;
  kind: 'muscle' | 'tendon';
  P: Float32Array;
  T: Uint32Array;
  /** Abultamiento relativo (h / h máx.) por vértice: la contracción lo usa. */
  bulge: Float32Array;
}

export interface LoftResult {
  pieces: LoftMesh[];
  /** Esferas que aproximan el volumen (para la piel y las capas siguientes). */
  spheres: Shape[];
  /** Las mismas, sin los tramos que salvan un hueco (no deben tender un puente de piel). */
  skinSpheres: Shape[];
}

function catmull(p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])];
}

/** Curva Catmull-Rom por una lista de puntos, parámetro s ∈ [0, 1] uniforme por tramo. */
function spline(pts: readonly V3[], s: number): V3 {
  const n = pts.length;
  if (n === 1) return pts[0]!;
  const x = clamp(s, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const t = x - i;
  const g = (k: number) => pts[clamp(k, 0, n - 1)]!;
  const p0 = i === 0 ? add(g(0), sub(g(0), g(1))) : g(i - 1);
  const p3 = i + 2 > n - 1 ? add(g(n - 1), sub(g(n - 1), g(n - 2))) : g(i + 2);
  return catmull(p0, g(i), g(i + 1), p3, t);
}

/** Remuestrea una polilínea a `n` puntos equiespaciados por longitud de arco. */
function resample(pts: readonly V3[], n: number): V3[] {
  if (pts.length === 1) return Array.from({ length: n }, () => pts[0]!);
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1]! + len(sub(pts[i]!, pts[i - 1]!)));
  const total = seg[seg.length - 1]! || 1;
  const out: V3[] = [];
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    let i = 1;
    while (i < seg.length - 1 && seg[i]! < d) i++;
    const t = (d - seg[i - 1]!) / Math.max(1e-9, seg[i]! - seg[i - 1]!);
    out.push(lerp3(pts[i - 1]!, pts[i]!, clamp(t, 0, 1)));
  }
  return out;
}

function piecewise(values: MuscleDef['h'], stations: number, v: number): number {
  const first = values[0];
  const pairs: ReadonlyArray<readonly [number, number]> =
    typeof first === 'number' ? (values as readonly number[]).map((h, i) => [stations > 1 ? i / (values.length - 1) : 0, h] as const) : (values as ReadonlyArray<readonly [number, number]>);
  if (v <= pairs[0]![0]) return pairs[0]![1];
  for (let i = 1; i < pairs.length; i++) {
    const [v1, h1] = pairs[i]!;
    const [v0, h0] = pairs[i - 1]!;
    if (v <= v1) {
      const t = (v - v0) / Math.max(1e-9, v1 - v0);
      const s = t * t * (3 - 2 * t);
      return h0 + (h1 - h0) * s;
    }
  }
  return pairs[pairs.length - 1]![1];
}

export function loftMuscle(def: MuscleDef, under: Field, sizeK = 1): LoftResult {
  const N = def.N ?? 9;
  const M = def.M ?? 16;
  const pw = def.pow ?? 0.5;
  const depth = def.depth ?? 0;
  const S = def.stations.length;
  const hAt = (v: number) => piecewise(def.h, S, v) * sizeK;
  const wrapAt = (v: number) => (def.wrap ? piecewise(def.wrap, S, v) : 1);

  // 1. Centros de las estaciones (para orientar las que vienen dadas por centro + anchura).
  const centers = def.stations.map((st) => ('c' in st ? st.c : resample(st.pts, 3)[1]!));
  const polys: V3[][] = def.stations.map((st, i) => {
    if ('pts' in st) return resample(st.pts, N);
    const prev = centers[Math.max(0, i - 1)]!;
    const next = centers[Math.min(S - 1, i + 1)]!;
    const t = norm(sub(next, prev));
    const n = gradient(under, ...st.c);
    let across = norm(cross(n, t));
    if (len(across) < 0.5) across = norm(cross([0, 1, 0], t));
    // Orientación coherente con la estación anterior.
    return resample([add(st.c, scale(across, -st.w / 2)), add(st.c, scale(across, st.w / 2))], N);
  });
  // Coherencia del sentido de u entre estaciones: si una polilínea va al revés, se invierte.
  for (let i = 1; i < S; i++) {
    const a = polys[i - 1]!;
    const b = polys[i]!;
    const d0 = len(sub(a[0]!, b[0]!)) + len(sub(a[N - 1]!, b[N - 1]!));
    const d1 = len(sub(a[0]!, b[N - 1]!)) + len(sub(a[N - 1]!, b[0]!));
    if (d1 < d0 && 'c' in def.stations[i]!) polys[i] = [...b].reverse();
  }

  // 2. Superficie media: spline a lo largo de cada fibra, reparametrizada por longitud de arco de la fibra central.
  const mid = Math.floor(N / 2);
  const dense = 64;
  const arc: number[] = [0];
  let prev = spline(polys.map((p) => p[mid]!), 0);
  for (let k = 1; k <= dense; k++) {
    const q = spline(polys.map((p) => p[mid]!), k / dense);
    arc.push(arc[k - 1]! + len(sub(q, prev)));
    prev = q;
  }
  const total = arc[dense]!;
  const sOf = (v: number) => {
    const d = v * total;
    let k = 1;
    while (k < dense && arc[k]! < d) k++;
    const t = (d - arc[k - 1]!) / Math.max(1e-9, arc[k]! - arc[k - 1]!);
    return (k - 1 + clamp(t, 0, 1)) / dense;
  };

  // Rejilla de la superficie media (posición y normal) y semigrosor.
  const Pm: V3[][] = [];
  const Nm: V3[][] = [];
  const hs: number[][] = [];
  let hMax = 0;
  for (let j = 0; j < M; j++) {
    const v = j / (M - 1);
    const s = sOf(v);
    const hv = hAt(v);
    const wv = wrapAt(v);
    const rowP: V3[] = [];
    const rowH: number[] = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const prof = Math.pow(Math.max(0, 1 - (2 * u - 1) ** 2), pw);
      const h = Math.max(0, hv * prof);
      const p0 = spline(polys.map((p) => p[i]!), s);
      const pw0 = wv > 0 ? project(under, p0, depth + h) : p0;
      rowP.push(lerp3(p0, pw0, wv));
      rowH.push(h);
      hMax = Math.max(hMax, h);
    }
    Pm.push(rowP);
    hs.push(rowH);
  }
  // Alisado de la superficie media (la capa de debajo es una unión de esferas, algo rugosa):
  // pasadas 1/4·1/2·1/4 a lo largo y a lo ancho, con los extremos fijos.
  const smooth = (G: V3[][], passes: number, fixEnds: boolean) => {
    for (let it = 0; it < passes; it++) {
      const C = G.map((r) => r.slice());
      for (let j = 0; j < M; j++) for (let i = 0; i < N; i++) {
        const jm = Math.max(0, j - 1);
        const jp = Math.min(M - 1, j + 1);
        const im = Math.max(0, i - 1);
        const ip = Math.min(N - 1, i + 1);
        const along = fixEnds && (j === 0 || j === M - 1) ? C[j]![i]! : add(scale(C[j]![i]!, 0.5), scale(add(C[jm]![i]!, C[jp]![i]!), 0.25));
        const across = add(scale(C[j]![i]!, 0.5), scale(add(C[j]![im]!, C[j]![ip]!), 0.25));
        G[j]![i] = scale(add(along, across), 0.5);
      }
    }
  };
  smooth(Pm, 2, true);
  for (let j = 0; j < M; j++) {
    const row: V3[] = [];
    for (let i = 0; i < N; i++) row.push(gradient(under, ...Pm[j]![i]!));
    Nm.push(row);
  }
  smooth(Nm, 3, false);
  const top: V3[][] = [];
  const bot: V3[][] = [];
  const spheres: Shape[] = [];
  const skinSpheres: Shape[] = [];
  for (let j = 0; j < M; j++) {
    const before = spheres.length;
    const rowT: V3[] = [];
    const rowB: V3[] = [];
    for (let i = 0; i < N; i++) {
      const P = Pm[j]![i]!;
      const n = norm(Nm[j]![i]!);
      const h = hs[j]![i]!;
      rowT.push(add(P, scale(n, h)));
      rowB.push(add(P, scale(n, -h)));
      if (h > 0.0015) spheres.push(sphere(P, h * 1.02));
      // Esferas intermedias (a lo ancho y a lo largo) para que el volumen no salga ondulado.
      if (i + 1 < N) {
        const hm = (h + hs[j]![i + 1]!) / 2;
        if (hm > 0.0015) spheres.push(sphere(lerp3(P, Pm[j]![i + 1]!, 0.5), hm));
      }
      if (j + 1 < M) {
        const hm = (h + hs[j + 1]![i]!) / 2;
        if (hm > 0.0015) spheres.push(sphere(lerp3(P, Pm[j + 1]![i]!, 0.5), hm));
      }
    }
    top.push(rowT);
    bot.push(rowB);
    if (wrapAt(j / (M - 1)) > 0.55) skinSpheres.push(...spheres.slice(before));
  }

  // 3. Malla: anillo = arriba u 0..N-1, abajo u N-2..1.
  const R = 2 * N - 2;
  const ring = (j: number) => {
    const pts: V3[] = [];
    const hh: number[] = [];
    for (let i = 0; i < N; i++) {
      pts.push(top[j]![i]!);
      hh.push(hs[j]![i]!);
    }
    for (let i = N - 2; i >= 1; i--) {
      pts.push(bot[j]![i]!);
      hh.push(hs[j]![i]!);
    }
    return { pts, hh };
  };
  const build = (j0: number, j1: number, capStart: boolean, capEnd: boolean, kind: LoftMesh['kind'], suffix: string): LoftMesh => {
    const P: number[] = [];
    const B: number[] = [];
    const T: number[] = [];
    for (let j = j0; j <= j1; j++) {
      const { pts, hh } = ring(j);
      for (let k = 0; k < R; k++) {
        P.push(...pts[k]!);
        B.push(hMax > 0 ? hh[k]! / hMax : 0);
      }
    }
    const rows = j1 - j0 + 1;
    for (let r = 0; r + 1 < rows; r++) for (let k = 0; k < R; k++) {
      const a = r * R + k;
      const b = r * R + ((k + 1) % R);
      const c = (r + 1) * R + ((k + 1) % R);
      const d = (r + 1) * R + k;
      T.push(a, b, c, a, c, d);
    }
    const cap = (r: number, flip: boolean) => {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let k = 0; k < R; k++) {
        cx += P[(r * R + k) * 3]!;
        cy += P[(r * R + k) * 3 + 1]!;
        cz += P[(r * R + k) * 3 + 2]!;
      }
      const ci = P.length / 3;
      P.push(cx / R, cy / R, cz / R);
      B.push(0);
      for (let k = 0; k < R; k++) {
        const a = r * R + k;
        const b = r * R + ((k + 1) % R);
        if (flip) T.push(ci, b, a);
        else T.push(ci, a, b);
      }
    };
    // Con el anillo antihorario visto desde +v, los laterales miran hacia fuera, la tapa inicial
    // tiene que mirar hacia −v (invertida) y la final hacia +v.
    if (capStart) cap(0, true);
    if (capEnd) cap(rows - 1, false);
    // Orientación: volumen con signo positivo = normales hacia fuera.
    let vol = 0;
    for (let t = 0; t < T.length; t += 3) {
      const a: V3 = [P[T[t]! * 3]!, P[T[t]! * 3 + 1]!, P[T[t]! * 3 + 2]!];
      const b: V3 = [P[T[t + 1]! * 3]!, P[T[t + 1]! * 3 + 1]!, P[T[t + 1]! * 3 + 2]!];
      const c: V3 = [P[T[t + 2]! * 3]!, P[T[t + 2]! * 3 + 1]!, P[T[t + 2]! * 3 + 2]!];
      vol += dot(a, cross(b, c));
    }
    if (vol < 0) for (let t = 0; t < T.length; t += 3) [T[t + 1], T[t + 2]] = [T[t + 2]!, T[t + 1]!];
    return { name: def.name + suffix, group: kind === 'tendon' ? 'tendon' : def.group, kind, P: Float32Array.from(P), T: Uint32Array.from(T), bulge: Float32Array.from(B) };
  };

  const pieces: LoftMesh[] = [];
  const [ta, tb] = def.tendon ?? [0, 1];
  const ja = Math.round(ta * (M - 1));
  const jb = Math.round(tb * (M - 1));
  if (ja > 0) pieces.push(build(0, ja, true, false, 'tendon', ' (tendón de origen)'));
  pieces.push(build(ja, jb, ja === 0, jb === M - 1, 'muscle', ''));
  if (jb < M - 1) {
    const t = build(jb, M - 1, false, true, 'tendon', ' (tendón)');
    t.bulge.fill(0);
    pieces.push(t);
  }
  if (ja > 0) pieces[0]!.bulge.fill(0);
  return { pieces, spheres, skinSpheres };
}
