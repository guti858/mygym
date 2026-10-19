import { Vector3 } from 'three';
import { DEG } from '../engine/math';

export interface CameraSpec {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  /** Píxeles por metro. */
  zoom: number;
  right: Vector3;
  camUp: Vector3;
  width: number;
  height: number;
}

/**
 * Cámara ortográfica a partir de azimut/elevación (grados). Azimut 0 = cámara en +Z mirando a −Z;
 * −90 = cámara en −X (lado derecho del usuario, vista sagital). Elevación 35,26° = isométrica verdadera.
 */
export function orthoCamera(opts: {
  azimuth: number;
  elevation: number;
  target: readonly [number, number, number];
  size: number;
  width: number;
  height: number;
  zoomFactor?: number;
}): CameraSpec {
  const az = opts.azimuth * DEG;
  const el = Math.min(89.5, opts.elevation) * DEG;
  const dir = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
  const target = new Vector3(opts.target[0], opts.target[1], opts.target[2]);
  const position = target.clone().add(dir.clone().multiplyScalar(30));
  const worldUp = new Vector3(0, 1, 0);
  const right = worldUp.clone().cross(dir).normalize();
  const camUp = dir.clone().cross(right).normalize();
  const zoom = (Math.min(opts.width, opts.height) / opts.size) * (opts.zoomFactor ?? 1);
  return { position, target, up: worldUp, zoom, right, camUp, width: opts.width, height: opts.height };
}

/** Proyección de un punto 3D a píxeles de la composición. */
export function project(cam: CameraSpec, p: Vector3): [number, number] {
  const d = p.clone().sub(cam.target);
  return [cam.width / 2 + cam.zoom * d.dot(cam.right), cam.height / 2 - cam.zoom * d.dot(cam.camUp)];
}

export interface Margins {
  top: number;
  bottom: number;
  side: number;
}

/** Encuadre automático: ajusta objetivo y zoom para que todos los `points` quepan dentro de los márgenes. */
export function fitCamera(opts: {
  azimuth: number;
  elevation: number;
  points: readonly Vector3[];
  width: number;
  height: number;
  margins: Margins;
  zoomFactor?: number;
}): CameraSpec {
  const c = new Vector3();
  for (const p of opts.points) c.add(p);
  c.divideScalar(Math.max(1, opts.points.length));
  const base = orthoCamera({ azimuth: opts.azimuth, elevation: opts.elevation, target: [c.x, c.y, c.z], size: 1, width: opts.width, height: opts.height });
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of opts.points) {
    const d = p.clone().sub(c);
    const u = d.dot(base.right);
    const v = d.dot(base.camUp);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const { top, bottom, side } = opts.margins;
  const availW = opts.width * (1 - 2 * side);
  const availH = opts.height * (1 - top - bottom);
  const zoom = Math.min(availW / Math.max(0.01, maxU - minU), availH / Math.max(0.01, maxV - minV)) * (opts.zoomFactor ?? 1);
  const boxCenter = c
    .clone()
    .add(base.right.clone().multiplyScalar((minU + maxU) / 2))
    .add(base.camUp.clone().multiplyScalar((minV + maxV) / 2));
  const yc = opts.height * top + availH / 2;
  const target = boxCenter.sub(base.camUp.clone().multiplyScalar((opts.height / 2 - yc) / zoom));
  const dir = base.position.clone().sub(base.target).normalize();
  return { ...base, target, position: target.clone().add(dir.multiplyScalar(30)), zoom };
}

/** Posición de la luz principal: a 40° del eje de la cámara y elevada, para modelar el volumen en cualquier vista. */
export function keyLightFor(cam: CameraSpec): [number, number, number] {
  const dir = cam.position.clone().sub(cam.target).setY(0);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize().applyAxisAngle(new Vector3(0, 1, 0), (40 * Math.PI) / 180);
  const p = cam.target.clone().add(dir.multiplyScalar(6)).add(new Vector3(0, 7, 0));
  return [p.x, p.y, p.z];
}

/** Las 8 esquinas de una caja alineada con los ejes. */
export function boxCorners(min: readonly [number, number, number], max: readonly [number, number, number]): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push(new Vector3(x, y, z));
  return out;
}
