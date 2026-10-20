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
  /** Margen derecho propio (p. ej. para un panel lateral); por defecto `side`. */
  right?: number;
}

/** Extensión en pantalla (metros, ejes de la cámara) de `points` vistos desde azimut/elevación. */
function screenExtent(azimuth: number, elevation: number, points: readonly Vector3[], c: Vector3) {
  const base = orthoCamera({ azimuth, elevation, target: [c.x, c.y, c.z], size: 1, width: 1, height: 1 });
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  const { right: r, camUp: up } = base;
  for (const p of points) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    const dz = p.z - c.z;
    const u = dx * r.x + dy * r.y + dz * r.z;
    const v = dx * up.x + dy * up.y + dz * up.z;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return { base, minU, maxU, minV, maxV };
}

/**
 * Azimuts con los que se busca la escala que vale para toda la vuelta. Cada 5°: la anchura en
 * pantalla tiene sus máximos en puntos suaves, así que entre muestras apenas crece (el 0,5 % de
 * holgura lo cubre).
 */
const ORBIT_SAMPLES = Array.from({ length: 72 }, (_, i) => i * 5);
const ORBIT_SLACK = 0.995;

/**
 * Encuadre automático: ajusta objetivo y zoom para que todos los `points` quepan dentro de los márgenes.
 *
 * Con `stable` la escala no depende del azimut: es la que hace caber los puntos desde cualquier
 * lado (a esa elevación). Así, al girar alrededor de la máquina, el cuerpo no «respira»: solo se
 * recentra el objetivo, como una cámara en órbita.
 */
export function fitCamera(opts: {
  azimuth: number;
  elevation: number;
  points: readonly Vector3[];
  width: number;
  height: number;
  margins: Margins;
  zoomFactor?: number;
  stable?: boolean;
}): CameraSpec {
  const c = new Vector3();
  for (const p of opts.points) c.add(p);
  c.divideScalar(Math.max(1, opts.points.length));
  const { top, bottom, side } = opts.margins;
  const right = opts.margins.right ?? side;
  const availW = opts.width * (1 - side - right);
  const availH = opts.height * (1 - top - bottom);
  const zoomAt = (e: { minU: number; maxU: number; minV: number; maxV: number }) =>
    Math.min(availW / Math.max(0.01, e.maxU - e.minU), availH / Math.max(0.01, e.maxV - e.minV));
  const ext = screenExtent(opts.azimuth, opts.elevation, opts.points, c);
  let zoom = zoomAt(ext);
  if (opts.stable) {
    zoom = Infinity;
    for (const az of ORBIT_SAMPLES) zoom = Math.min(zoom, zoomAt(screenExtent(az, opts.elevation, opts.points, c)));
    zoom *= ORBIT_SLACK;
  }
  zoom *= opts.zoomFactor ?? 1;
  const base = orthoCamera({ azimuth: opts.azimuth, elevation: opts.elevation, target: [c.x, c.y, c.z], size: 1, width: opts.width, height: opts.height });
  const boxCenter = c
    .clone()
    .add(base.right.clone().multiplyScalar((ext.minU + ext.maxU) / 2))
    .add(base.camUp.clone().multiplyScalar((ext.minV + ext.maxV) / 2));
  const yc = opts.height * top + availH / 2;
  const xc = opts.width * side + availW / 2;
  const target = boxCenter
    .sub(base.camUp.clone().multiplyScalar((opts.height / 2 - yc) / zoom))
    .sub(base.right.clone().multiplyScalar((xc - opts.width / 2) / zoom));
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
