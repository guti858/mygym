import { Vector3 } from 'three';
import { boxCorners, fitCamera, type CameraSpec, type Margins } from './camera';
import { HUB_FLOOR } from './layout';

/**
 * Cámara del plano del gimnasio: giro, inclinación, zoom y desplazamiento sobre el suelo.
 * Sin React: la usan la composición (para pintar) y la vista (tarjeta, teclado, vuelo a una máquina).
 */

/** Elevación de la isométrica verdadera. */
export const HUB_ISO_ELEVATION = 35.264;
/** Vista en planta (cenital): a 89°, no a 90°, para que la cámara conserve su orientación. */
export const HUB_PLAN_ELEVATION = 89;
/** Inclinación que el usuario puede elegir (fuera de la planta). */
export const HUB_TILT: readonly [number, number] = [20, 60];
/** Zoom del usuario: 1 = el gimnasio entero. El vuelo a una máquina puede pasar de aquí. */
export const HUB_ZOOM: readonly [number, number] = [1, 3.5];
const FLIGHT_MAX_ZOOM = 5;

export interface HubView {
  /** Grados; −45 = isométrica de arranque. */
  azimuth: number;
  elevation: number;
  zoom: number;
  /** Desplazamiento del objetivo sobre el suelo (x, z), en metros. */
  panX: number;
  panZ: number;
}

export const HUB_HOME: HubView = { azimuth: -45, elevation: HUB_ISO_ELEVATION, zoom: 1, panX: 0, panZ: 0 };

/** Márgenes del encuadre; en la app, abajo queda sitio para la barra de vista. */
export function hubMargins(embedded = false): Margins {
  return { top: 0.06, bottom: embedded ? 0.1 : 0.02, side: 0.02 };
}

const FLOOR_BOX = boxCorners([-HUB_FLOOR[0] / 2, 0, -HUB_FLOOR[1] / 2], [HUB_FLOOR[0] / 2, 1.2, HUB_FLOOR[1] / 2]);

interface Size {
  width: number;
  height: number;
}

/** El gimnasio entero visto con este azimut y elevación (zoom 1, sin desplazar). */
function baseCamera(azimuth: number, elevation: number, size: Size, margins: Margins): CameraSpec {
  return fitCamera({ azimuth, elevation, points: FLOOR_BOX, width: size.width, height: size.height, margins });
}

export function hubCamera(view: HubView, size: Size, margins: Margins = hubMargins()): CameraSpec {
  const base = baseCamera(view.azimuth, view.elevation, size, margins);
  const target = base.target.clone().add(new Vector3(view.panX, 0, view.panZ));
  const dir = base.position.clone().sub(base.target).normalize();
  return { ...base, target, position: target.clone().add(dir.multiplyScalar(30)), zoom: base.zoom * view.zoom };
}

/**
 * Desplazamiento sobre el suelo equivalente (en pantalla) a mover el objetivo `d`: la cámara es
 * ortográfica, así que moverlo a lo largo de la dirección de vista no cambia la imagen.
 */
function toFloor(cam: CameraSpec, d: Vector3): [number, number] {
  const dir = cam.position.clone().sub(cam.target).normalize();
  const t = d.y / Math.max(1e-3, dir.y);
  return [d.x - t * dir.x, d.z - t * dir.z];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Desplazamiento máximo para un zoom: con zoom 1 el plano queda centrado; con más, se llega a los bordes. */
export function clampPan(view: HubView): HubView {
  const k = Math.max(0, 1 - 1 / view.zoom);
  const lx = (HUB_FLOOR[0] / 2 + 1) * k;
  const lz = (HUB_FLOOR[1] / 2 + 1) * k;
  // (+ 0: sin «−0» al centrar)
  return { ...view, panX: clamp(view.panX, -lx, lx) + 0, panZ: clamp(view.panZ, -lz, lz) + 0 };
}

/** Arrastre: el suelo sigue al puntero `dx`, `dy` píxeles de la composición. */
export function panBy(view: HubView, cam: CameraSpec, dx: number, dy: number): HubView {
  const d = cam.right
    .clone()
    .multiplyScalar(-dx / cam.zoom)
    .add(cam.camUp.clone().multiplyScalar(dy / cam.zoom));
  const [fx, fz] = toFloor(cam, d);
  return clampPan({ ...view, panX: view.panX + fx, panZ: view.panZ + fz });
}

/** Zoom por `factor` sin mover el punto de la composición (`px`, `py`) que queda bajo el puntero. */
export function zoomAt(view: HubView, cam: CameraSpec, factor: number, px: number, py: number): HubView {
  const zoom = clamp(view.zoom * factor, HUB_ZOOM[0], HUB_ZOOM[1]);
  const z0 = cam.zoom;
  const z1 = (cam.zoom / view.zoom) * zoom;
  const ox = px - cam.width / 2;
  const oy = py - cam.height / 2;
  const d = cam.right
    .clone()
    .multiplyScalar(ox)
    .sub(cam.camUp.clone().multiplyScalar(oy))
    .multiplyScalar(1 / z0 - 1 / z1);
  const [fx, fz] = toFloor(cam, d);
  return clampPan({ ...view, zoom, panX: view.panX + fx, panZ: view.panZ + fz });
}

/**
 * Vista que encuadra `points` (la máquina) con los mismos márgenes que la estación dentro de la app,
 * desde el azimut y la elevación actuales: así el acercamiento acaba con el encuadre con el que se
 * abre la estación.
 */
export function focusView(view: HubView, points: readonly Vector3[], size: Size, margins: Margins = hubMargins()): HubView {
  const base = baseCamera(view.azimuth, view.elevation, size, margins);
  const fit = fitCamera({ azimuth: view.azimuth, elevation: view.elevation, points, width: size.width, height: size.height, margins: { top: 0.09, bottom: 0.1, side: 0.04 } });
  // Con el zoom limitado, la máquina queda igualmente en el centro del encuadre (algo más pequeña).
  const zoom = clamp(fit.zoom / base.zoom, 1, FLIGHT_MAX_ZOOM);
  const [panX, panZ] = toFloor(base, fit.target.clone().sub(base.target));
  return { ...view, zoom, panX, panZ };
}

/** Punto del suelo (x, z) que se ve en el píxel (`px`, `py`) de la composición. */
export function screenToFloor(cam: CameraSpec, px: number, py: number): [number, number] {
  const dir = cam.position.clone().sub(cam.target).normalize();
  const o = cam.target
    .clone()
    .add(cam.right.clone().multiplyScalar((px - cam.width / 2) / cam.zoom))
    .sub(cam.camUp.clone().multiplyScalar((py - cam.height / 2) / cam.zoom));
  const t = o.y / Math.max(1e-3, dir.y);
  return [o.x - dir.x * t, o.z - dir.z * t];
}

/** La misma vista, desplazada para que el punto del suelo (x, z) quede en el centro (mini-mapa). */
export function centerOn(view: HubView, point: readonly [number, number], size: Size, margins: Margins = hubMargins()): HubView {
  const cam = hubCamera(view, size, margins);
  const [cx, cz] = screenToFloor(cam, size.width / 2, size.height / 2);
  return clampPan({ ...view, panX: view.panX + point[0] - cx, panZ: view.panZ + point[1] - cz });
}

/** Rótulos según el zoom: 0 = zonas y nombres; 1 = además el músculo principal; 2 = sin zonas. */
export function labelLevel(zoom: number): 0 | 1 | 2 {
  return zoom <= 1.2 ? 0 : zoom <= 2.2 ? 1 : 2;
}

export interface ScreenItem {
  id: string;
  x: number;
  y: number;
}

/**
 * Navegación con flechas por el plano: la estación más cercana en pantalla en la dirección pedida
 * (cono de ±60°, penalizando lo que se aparta del eje). Sin selección, la más cercana al centro.
 */
export function neighbor(items: readonly ScreenItem[], from: ScreenItem | null, dir: 'left' | 'right' | 'up' | 'down', center: { x: number; y: number }): string | null {
  if (!from) {
    let best: ScreenItem | null = null;
    for (const it of items) if (!best || Math.hypot(it.x - center.x, it.y - center.y) < Math.hypot(best.x - center.x, best.y - center.y)) best = it;
    return best?.id ?? null;
  }
  const [ux, uy] = ({ left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const)[dir];
  let best: string | null = null;
  let bestScore = Infinity;
  for (const it of items) {
    if (it.id === from.id) continue;
    const dx = it.x - from.x;
    const dy = it.y - from.y;
    const along = dx * ux + dy * uy;
    const across = Math.abs(dx * uy - dy * ux);
    if (along <= 0 || across > along * Math.tan((60 * Math.PI) / 180)) continue;
    const score = along + 2 * across;
    if (score < bestScore) {
      bestScore = score;
      best = it.id;
    }
  }
  return best;
}
