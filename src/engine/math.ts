import { Quaternion, Vector3 } from 'three';

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;

export const v3 = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => (b === a ? 0 : (x - a) / (b - a));

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Cuaternión a partir de un eje (unitario) y un ángulo en grados. */
export const qAxis = (axis: Vector3, deg: number) =>
  new Quaternion().setFromAxisAngle(axis.clone().normalize(), deg * DEG);

/** Ángulo entre dos vectores, en grados (0–180). */
export function angleDeg(a: Vector3, b: Vector3): number {
  const la = a.length();
  const lb = b.length();
  if (la < 1e-12 || lb < 1e-12) return 0;
  return Math.acos(clamp(a.dot(b) / (la * lb), -1, 1)) * RAD;
}

/** Ángulo con signo de `a` a `b` alrededor de `axis` (proyectando ambos en el plano ⊥ axis). */
export function signedAngleAround(a: Vector3, b: Vector3, axis: Vector3): number {
  const n = axis.clone().normalize();
  const pa = a.clone().sub(n.clone().multiplyScalar(a.dot(n)));
  const pb = b.clone().sub(n.clone().multiplyScalar(b.dot(n)));
  if (pa.lengthSq() < 1e-12 || pb.lengthSq() < 1e-12) return 0;
  const cross = pa.clone().cross(pb);
  return Math.atan2(n.dot(cross), pa.dot(pb)) * RAD;
}

/** Un vector perpendicular cualquiera a `v`. */
export function anyPerpendicular(v: Vector3): Vector3 {
  const a = Math.abs(v.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  return a.cross(v).normalize();
}

/**
 * Sistema de referencia rígido (origen + orientación).
 * Convención del cuerpo: X = izquierda, Y = arriba (craneal), Z = anterior.
 */
export class Frame {
  constructor(
    public origin: Vector3 = new Vector3(),
    public q: Quaternion = new Quaternion(),
  ) {}

  point(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z).applyQuaternion(this.q).add(this.origin);
  }

  pointV(local: Vector3): Vector3 {
    return local.clone().applyQuaternion(this.q).add(this.origin);
  }

  dir(x: number, y: number, z: number): Vector3 {
    return new Vector3(x, y, z).applyQuaternion(this.q);
  }

  get x() {
    return this.dir(1, 0, 0);
  }
  get y() {
    return this.dir(0, 1, 0);
  }
  get z() {
    return this.dir(0, 0, 1);
  }

  /** Rotación intrínseca (en ejes locales). */
  rotated(local: Quaternion): Frame {
    return new Frame(this.origin.clone(), this.q.clone().multiply(local));
  }

  /** Rota el sistema alrededor de un punto local fijo (que no se mueve). */
  rotatedAbout(pivotLocal: Vector3, local: Quaternion): Frame {
    const pivotWorld = this.pointV(pivotLocal);
    const q = this.q.clone().multiply(local);
    const origin = pivotWorld.clone().sub(pivotLocal.clone().applyQuaternion(q));
    return new Frame(origin, q);
  }

  at(origin: Vector3): Frame {
    return new Frame(origin.clone(), this.q.clone());
  }

  toLocalDir(v: Vector3): Vector3 {
    return v.clone().applyQuaternion(this.q.clone().invert());
  }

  toLocalPoint(p: Vector3): Vector3 {
    return p.clone().sub(this.origin).applyQuaternion(this.q.clone().invert());
  }

  clone(): Frame {
    return new Frame(this.origin.clone(), this.q.clone());
  }
}

/** Interpolación lineal por tramos en una lista de claves {p, v} ordenada por p. */
export function sampleKeys(keys: ReadonlyArray<{ p: number; v: number }>, p: number): number {
  if (keys.length === 0) return 0;
  const first = keys[0]!;
  if (p <= first.p) return first.v;
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i]!;
    if (p <= k1.p) {
      const k0 = keys[i - 1]!;
      return lerp(k0.v, k1.v, invLerp(k0.p, k1.p, p));
    }
  }
  return keys[keys.length - 1]!.v;
}
