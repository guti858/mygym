/**
 * Campos de distancia con signo (SDF) para el generador del modelo anatómico.
 * Negativo dentro, positivo fuera, en metros. Todo trabaja con números sueltos (sin objetos por
 * punto): el mallado y la proyección de fibras evalúan millones de muestras.
 */

export type V3 = readonly [number, number, number];
export type Field = (x: number, y: number, z: number) => number;

export interface Shape {
  f: Field;
  /** Caja que contiene la superficie (con margen); fuera de ella la forma no influye. */
  lo: V3;
  hi: V3;
}

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const dist = (a: V3, b: V3) => len(sub(a, b));
export const mirrorX = (a: V3): V3 => [-a[0], a[1], a[2]];
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Unión suave polinómica (k en metros: anchura del acuerdo). */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function box(lo: V3, hi: V3, m: number): { lo: V3; hi: V3 } {
  return { lo: [lo[0] - m, lo[1] - m, lo[2] - m], hi: [hi[0] + m, hi[1] + m, hi[2] + m] };
}

export function sphere(c: V3, r: number): Shape {
  const [cx, cy, cz] = c;
  return { f: (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r, ...box(c, c, r) };
}

/**
 * Elipsoide con semiejes `r` a lo largo de una base ortonormal (`ax`, `ay`, `az`); por defecto,
 * los ejes del mundo. Distancia aproximada (cota de Íñigo Quílez), buena cerca de la superficie.
 */
export function ellipsoid(c: V3, r: V3, basis?: readonly [V3, V3, V3]): Shape {
  const [cx, cy, cz] = c;
  const [rx, ry, rz] = r;
  const B = basis ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [a, b, d] = B;
  const f: Field = (x, y, z) => {
    const px = x - cx;
    const py = y - cy;
    const pz = z - cz;
    const u = px * a[0] + py * a[1] + pz * a[2];
    const v = px * b[0] + py * b[1] + pz * b[2];
    const w = px * d[0] + py * d[1] + pz * d[2];
    const k0 = Math.hypot(u / rx, v / ry, w / rz);
    const k1 = Math.hypot(u / (rx * rx), v / (ry * ry), w / (rz * rz));
    if (k1 < 1e-12) return -Math.min(rx, ry, rz);
    return (k0 * (k0 - 1)) / k1;
  };
  const m = Math.max(rx, ry, rz);
  return { f, ...box(c, c, m) };
}

/** Cono redondeado: segmento a → b con radio ra en a y rb en b (distancia exacta). */
export function roundCone(a: V3, b: V3, ra: number, rb: number): Shape {
  const ba = sub(b, a);
  const l2 = dot(ba, ba);
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / Math.max(l2, 1e-12);
  const f: Field = (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const yv = px * ba[0] + py * ba[1] + pz * ba[2];
    const zv = yv - l2;
    const qx = px * l2 - ba[0] * yv;
    const qy = py * l2 - ba[1] * yv;
    const qz = pz * l2 - ba[2] * yv;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yv * yv * l2;
    const z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
  };
  const m = Math.max(ra, rb);
  return { f, ...box([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])], m) };
}

export const capsule = (a: V3, b: V3, r: number) => roundCone(a, b, r, r);

/** Caja redondeada orientada (semitamaños `h`, radio de canto `r`). */
export function roundBox(c: V3, h: V3, r: number, basis?: readonly [V3, V3, V3]): Shape {
  const B = basis ?? [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [a, b, d] = B;
  const f: Field = (x, y, z) => {
    const px = x - c[0];
    const py = y - c[1];
    const pz = z - c[2];
    const u = Math.abs(px * a[0] + py * a[1] + pz * a[2]) - h[0] + r;
    const v = Math.abs(px * b[0] + py * b[1] + pz * b[2]) - h[1] + r;
    const w = Math.abs(px * d[0] + py * d[1] + pz * d[2]) - h[2] + r;
    const out = Math.hypot(Math.max(u, 0), Math.max(v, 0), Math.max(w, 0));
    return out + Math.min(Math.max(u, v, w), 0) - r;
  };
  const m = Math.hypot(h[0], h[1], h[2]);
  return { f, ...box(c, c, m) };
}

/** Cadena de conos redondeados por una polilínea con radios por punto. */
export function tube(pts: readonly V3[], radii: readonly number[]): Shape[] {
  const out: Shape[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(roundCone(pts[i]!, pts[i + 1]!, radii[i]!, radii[i + 1]!));
  return out;
}

/**
 * Unión suave de muchas formas con poda por cajas: cada consulta solo evalúa las formas cuya caja
 * (ampliada por `k`) contiene el punto. Las cajas se indexan en una rejilla gruesa.
 */
export class Union {
  private shapes: Shape[] = [];
  private grid = new Map<number, number[]>();
  private cell = 0.05;
  constructor(
    shapes: readonly Shape[],
    private k: number,
    /** Valor fuera de todas las cajas (lejos del cuerpo). */
    private far = 0.25,
  ) {
    this.shapes = [...shapes];
    this.shapes.forEach((s, i) => {
      const [x0, y0, z0] = this.key3(s.lo, -k);
      const [x1, y1, z1] = this.key3(s.hi, k);
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const key = this.hash(x, y, z);
        const list = this.grid.get(key);
        if (list) list.push(i);
        else this.grid.set(key, [i]);
      }
    });
  }
  private key3(p: V3, m: number): [number, number, number] {
    const c = this.cell;
    return [Math.floor((p[0] + m) / c), Math.floor((p[1] + m) / c), Math.floor((p[2] + m) / c)];
  }
  private hash(x: number, y: number, z: number) {
    return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512);
  }
  readonly f: Field = (x, y, z) => {
    const c = this.cell;
    const list = this.grid.get(this.hash(Math.floor(x / c), Math.floor(y / c), Math.floor(z / c)));
    if (!list) return this.far;
    let d = this.far;
    for (const i of list) {
      const s = this.shapes[i]!;
      if (x < s.lo[0] - this.k || y < s.lo[1] - this.k || z < s.lo[2] - this.k || x > s.hi[0] + this.k || y > s.hi[1] + this.k || z > s.hi[2] + this.k) continue;
      d = smin(d, s.f(x, y, z), this.k);
    }
    return d;
  };
  get bounds(): { lo: V3; hi: V3 } {
    const lo: [number, number, number] = [Infinity, Infinity, Infinity];
    const hi: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (const s of this.shapes) for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, s.lo[i]!);
      hi[i] = Math.max(hi[i]!, s.hi[i]!);
    }
    return { lo, hi };
  }
}

/** Gradiente numérico normalizado (hacia fuera). */
export function gradient(f: Field, x: number, y: number, z: number, e = 1e-3): V3 {
  const gx = f(x + e, y, z) - f(x - e, y, z);
  const gy = f(x, y + e, z) - f(x, y - e, z);
  const gz = f(x, y, z + e) - f(x, y, z - e);
  return norm([gx, gy, gz]);
}

/** Lleva `p` a la isosuperficie f = level siguiendo el gradiente (Newton amortiguado). */
export function project(f: Field, p: V3, level: number, iters = 8): V3 {
  let [x, y, z] = p;
  for (let i = 0; i < iters; i++) {
    const d = f(x, y, z) - level;
    if (Math.abs(d) < 2e-5) break;
    const g = gradient(f, x, y, z);
    const step = clamp(d, -0.04, 0.04);
    x -= g[0] * step;
    y -= g[1] * step;
    z -= g[2] * step;
  }
  return [x, y, z];
}

/** Punto de la isosuperficie f = level en el rayo desde `o` (dentro) en la dirección `dir`. */
export function rayHit(f: Field, o: V3, dir: V3, level = 0, maxT = 0.6): V3 {
  const d = norm(dir);
  let t = 0;
  const at = (s: number): V3 => [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
  let prev = f(...at(0)) - level;
  // Origen ya fuera (o sin corte en el alcance): el punto de la superficie más cercano.
  if (prev >= 0) return project(f, o, level, 16);
  for (; t < maxT; t += 0.004) {
    const v = f(...at(t + 0.004)) - level;
    if (prev < 0 && v >= 0) {
      let lo = t;
      let hi = t + 0.004;
      for (let i = 0; i < 20; i++) {
        const m = (lo + hi) / 2;
        if (f(...at(m)) - level < 0) lo = m;
        else hi = m;
      }
      return at((lo + hi) / 2);
    }
    prev = v;
  }
  return project(f, at(0), level, 16);
}
