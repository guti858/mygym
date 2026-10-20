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

/** Suelo del gimnasio (ancho en X, fondo en Z). */
export const HUB_FLOOR: readonly [number, number] = [19, 13];
export const HUB_HEIGHT = 3.2;

export const HUB_ZONES: Record<Zone, ZoneRect> = {
  traccion: { x: -4.75, z: -3.9, w: 9.3, d: 5.0 },
  brazos: { x: 1.4, z: -3.9, w: 2.9, d: 5.0 },
  pierna: { x: 6.15, z: -2.4, w: 6.5, d: 8.0 },
  empuje: { x: -3.35, z: 2.6, w: 12.1, d: 7.6 },
  libre: { x: 6.15, z: 4.7, w: 6.5, d: 3.4 },
};

/** Sala de una estación: cuadrada y centrada en la máquina. */
export const STATION_ROOM = { size: 5.6, height: 3.2 } as const;
