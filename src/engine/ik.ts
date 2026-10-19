import { Vector3 } from 'three';
import { anyPerpendicular, clamp } from './math';

export interface TwoBoneResult {
  mid: Vector3;
  end: Vector3;
  reachable: boolean;
  /** Distancia que faltó para alcanzar el objetivo (0 si alcanzable). */
  shortfall: number;
}

/**
 * IK analítica de dos huesos (ley de cosenos).
 * `pole` indica hacia dónde debe apuntar la articulación intermedia (codo/rodilla).
 */
export function twoBoneIK(
  root: Vector3,
  target: Vector3,
  a: number,
  b: number,
  pole: Vector3,
): TwoBoneResult {
  const toT = target.clone().sub(root);
  const d = toT.length();
  const minD = Math.abs(a - b) + 1e-4;
  const maxD = a + b - 1e-4;
  const reachable = d <= maxD + 1e-6 && d >= minD - 1e-6;
  const dc = clamp(d, minD, maxD);
  const u = d > 1e-9 ? toT.divideScalar(d) : new Vector3(0, -1, 0);
  let v = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u)));
  if (v.lengthSq() < 1e-10) v = anyPerpendicular(u);
  v.normalize();
  const cosA = clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const mid = root
    .clone()
    .add(u.clone().multiplyScalar(a * cosA))
    .add(v.clone().multiplyScalar(a * sinA));
  const end = root.clone().add(u.clone().multiplyScalar(dc));
  return { mid, end, reachable, shortfall: Math.max(0, d - maxD) };
}
