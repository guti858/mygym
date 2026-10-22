import { PLATES } from '../../engine/load';
import { DEG } from '../../engine/math';
import type { ScenePalette } from '../palette';

/**
 * Traducción de las «ranuras» de material de las salas horneadas a los colores del tema, y regla
 * de visibilidad de las paredes según la cámara. Sin three.js: se prueba en node.
 */

export type WallKey = 'xp' | 'xn' | 'zp' | 'zn';

/** Normal de cada pared hacia el interior de la sala (x, z). */
const INWARD: Record<WallKey, readonly [number, number]> = { xp: [-1, 0], xn: [1, 0], zp: [0, -1], zn: [0, 1] };

export const isWallKey = (k: unknown): k is WallKey => typeof k === 'string' && k in INWARD;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Opacidad de una pared (y de lo que cuelga de ella) para una cámara con este azimut: 1 si queda
 * detrás de la máquina o de canto, 0 si se interpone entre la cámara y la máquina. El paso es
 * gradual (unos 20° de giro), así que al orbitar la pared se desvanece en lugar de saltar.
 */
export function wallOpacity(key: WallKey, azimuthDeg: number): number {
  const az = azimuthDeg * DEG;
  const [nx, nz] = INWARD[key];
  return smoothstep(-0.35, -0.05, nx * Math.sin(az) + nz * Math.cos(az));
}

/** Color del tema para una ranura de material del script de Blender. */
export function slotColor(p: ScenePalette, slot: string): string {
  if (slot.startsWith('zone_')) return p.zone[slot.slice(5) as keyof ScenePalette['zone']] ?? p.room.floorA;
  if (slot.startsWith('plate')) return PLATES.find((s) => s.kg === Number(slot.slice(5)))?.color ?? p.metal;
  const map: Record<string, string> = {
    floor: p.room.floorA,
    wall: p.room.wall,
    wallLow: p.room.wallLow,
    skirt: p.room.seam,
    accent: p.accent,
    decal: p.room.decal,
    frame: p.frameDark,
    metal: p.metal,
    pad: p.pad,
    mirror: p.room.mirror,
    led: p.room.led,
    wood: p.room.wood,
    plant: p.room.plant,
    line: p.room.line,
    concrete: p.room.concrete,
    window: p.room.window,
    screen: p.room.screen,
    iron: p.room.iron,
    // Logotipo: el color del texto de la interfaz (como «MYGYM» en la cabecera).
    sign: p.label,
    // Lo que se ve por los ventanales: la textura pone cielo, edificios y árboles; el tema, el tono.
    exterior: p.room.window,
  };
  return map[slot] ?? p.room.wall;
}

/** «sala/ranura~modo» → ranura y modo de luz ('atlas' si no lleva sufijo). */
export function parseMaterialName(name: string): { slot: string; mode: 'atlas' | 'vertex' | 'none' } {
  const [, rest = name] = name.split('/');
  const [slot = rest, mode] = rest.split('~');
  return { slot, mode: mode === 'vertex' || mode === 'none' ? mode : 'atlas' };
}
