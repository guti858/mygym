import type { Zone } from '../stations/catalog';

/**
 * Planta del gimnasio y de la sala de cada estación (metros, ejes de la escena: X derecha, Y arriba,
 * Z hacia la cámara frontal). Es la fuente única de la que beben la escena y el script de Blender
 * que genera las salas (`scripts/environment/layout.ts` la vuelca a JSON).
 */

export interface ZoneRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/**
 * Suelo del gimnasio (ancho en X, fondo en Z). Tres filas de máquinas con pasillos de al menos
 * 1,45 m entre huellas: al fondo tracción, brazos y pierna (contra los espejos); en medio, empuje; y
 * delante, la zona libre, la entrada con la recepción y el cardio junto a los ventanales.
 */
export const HUB_FLOOR: readonly [number, number] = [17.5, 12.5];
export const HUB_HEIGHT = 3.2;

export const HUB_ZONES: Record<Zone, ZoneRect> = {
  traccion: { x: -4.45, z: -4.2, w: 8.2, d: 3.7 },
  brazos: { x: 1.15, z: -4.2, w: 2.6, d: 3.7 },
  pierna: { x: 5.6, z: -4.2, w: 5.9, d: 3.7 },
  empuje: { x: -0.95, z: 0.05, w: 15.2, d: 2.7 },
  libre: { x: -4.575, z: 3.95, w: 7.95, d: 3.1 },
};

/** Áreas sin estación (atrezo horneado): se pintan en el suelo y se rotulan en el plano. */
export type HubAreaId = 'cardio' | 'recepcion';
export interface HubArea extends ZoneRect {
  id: HubAreaId;
  label: string;
}
export const HUB_AREAS: readonly HubArea[] = [
  { id: 'cardio', label: 'Cardio', x: 6.75, z: 4.15, w: 3.7, d: 3.7 },
  { id: 'recepcion', label: 'Recepción', x: 3.85, z: 5.0, w: 2.1, d: 1.6 },
];

/**
 * Recorrido docente: calentar en el cardio, empuje, tracción, brazos, pierna y estirar en la zona
 * libre. Cada paso tiene su marca numerada pintada en el pasillo (x, z); `HUB_PATH` es la línea de
 * flechas pintadas desde la entrada (pasa por el pasillo sur, el oeste y el norte).
 */
export const HUB_ROUTE: readonly { id: Zone | 'cardio'; marker: readonly [number, number] }[] = [
  { id: 'cardio', marker: [4.6, 3.1] },
  { id: 'empuje', marker: [-1.1, 1.9] },
  { id: 'traccion', marker: [-8.2, -1.85] },
  { id: 'brazos', marker: [-0.25, -1.85] },
  { id: 'pierna', marker: [2.55, -1.85] },
  { id: 'libre', marker: [-0.95, 3.0] },
];
export const HUB_PATH: readonly (readonly [number, number])[] = [
  [1.5, 3.7],
  [1.5, 1.9],
  [-8.2, 1.9],
  [-8.2, -1.85],
  [7.8, -1.85],
];

/** Sala de una estación: cuadrada y centrada en la máquina. */
export const STATION_ROOM = { size: 5.6, height: 3.2 } as const;
