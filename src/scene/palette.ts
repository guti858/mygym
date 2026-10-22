import type { MuscleRole } from '../content/muscles';
import type { Status } from '../engine/types';

export type ThemeId = 'oscuro' | 'claro' | 'terminal';

export interface ScenePalette {
  bg: string;
  floor: string;
  floorLine: string;
  frame: string;
  frameDark: string;
  pad: string;
  metal: string;
  accent: string;
  avatar: string;
  avatarDark: string;
  cable: string;
  label: string;
  labelBg: string;
  zone: Record<'empuje' | 'traccion' | 'brazos' | 'pierna' | 'libre', string>;
  status: Record<Status, string>;
  muscle: Record<MuscleRole, string>;
  /** Sala: paredes, suelo de caucho, espejos e iluminación. */
  room: {
    wall: string;
    wallLow: string;
    floorA: string;
    floorB: string;
    speck: string;
    seam: string;
    mirror: string;
    led: string;
    decal: string;
    /** Sala horneada con Blender (src/scene/env): materiales que no tenía la sala procedural. */
    wood: string;
    plant: string;
    line: string;
    concrete: string;
    window: string;
    screen: string;
    iron: string;
  };
  /** Materiales del modelo anatómico. */
  anatomy: {
    muscle: string;
    /** Capa profunda: lo que se ve entre músculos. */
    deep: string;
    tendon: string;
    bone: string;
    skin: string;
    glove: string;
    shoe: string;
    hair: string;
    eye: string;
    iris: string;
  };
}

const STATUS = { ok: '#2fbf71', aviso: '#f2b705', riesgo: '#ff3b5c' } as const;
const MUSCLE = { principal: '#e2453c', sinergista: '#f0883e', estabilizador: '#3d8bfd' } as const;

export const PALETTES: Record<ThemeId, ScenePalette> = {
  oscuro: {
    bg: '#0e1116',
    floor: '#1a1f27',
    floorLine: '#262d38',
    frame: '#5d6879',
    frameDark: '#3e4654',
    pad: '#22262e',
    metal: '#a7b0bd',
    accent: '#ff7a3d',
    avatar: '#d8d2c6',
    avatarDark: '#a69f93',
    cable: '#11151b',
    label: '#e8eaed',
    labelBg: 'rgba(14,17,22,0.9)',
    zone: { empuje: '#3a2a26', traccion: '#232f3d', brazos: '#2e2a3d', pierna: '#233628', libre: '#36321f' },
    status: STATUS,
    muscle: MUSCLE,
    room: {
      wall: '#262b34',
      wallLow: '#1b1f26',
      floorA: '#1c1f24',
      floorB: '#202429',
      speck: '#3b414a',
      seam: '#111317',
      mirror: '#a9b8c9',
      led: '#ffe4bd',
      decal: '#ff7a3d',
      wood: '#6e5440',
      plant: '#3d5f3a',
      line: '#4a515d',
      concrete: '#3a3f48',
      window: '#3a5372',
      screen: '#0b0e12',
      iron: '#1a1d22',
    },
    anatomy: {
      muscle: '#8a6560',
      deep: '#4f3735',
      tendon: '#bfae9d',
      bone: '#e4d9c1',
      skin: '#c7ad98',
      glove: '#2b313b',
      shoe: '#20252d',
      hair: '#2a221d',
      eye: '#efece6',
      iris: '#3a2b22',
    },
  },
  claro: {
    bg: '#eef0f3',
    floor: '#dfe3e8',
    floorLine: '#cdd3db',
    frame: '#59626f',
    frameDark: '#3c434e',
    pad: '#2b3038',
    metal: '#8b95a3',
    accent: '#e8611d',
    avatar: '#cfc6b6',
    avatarDark: '#9a907f',
    cable: '#1d2228',
    label: '#14181d',
    labelBg: 'rgba(255,255,255,0.92)',
    zone: { empuje: '#f0ddd6', traccion: '#d7e3f0', brazos: '#e2dcf0', pierna: '#d8ebdc', libre: '#efe8cf' },
    status: { ok: '#13965a', aviso: '#c98a00', riesgo: '#e0193f' },
    muscle: MUSCLE,
    room: {
      wall: '#e7e9ed',
      wallLow: '#d2d7de',
      floorA: '#b4bac3',
      floorB: '#bcc2ca',
      speck: '#8a919b',
      seam: '#9ba2ac',
      mirror: '#cfdbe8',
      led: '#fff4de',
      decal: '#e8611d',
      wood: '#c49a6c',
      plant: '#5b8a55',
      line: '#f6f6f3',
      concrete: '#c4c7cc',
      window: '#e3eef9',
      screen: '#1d2329',
      iron: '#2a2e34',
    },
    anatomy: {
      muscle: '#b78a83',
      deep: '#7d5a54',
      tendon: '#d6c8b8',
      bone: '#ede3cc',
      skin: '#d3b7a1',
      glove: '#363c46',
      shoe: '#2a2f37',
      hair: '#30261f',
      eye: '#f5f2ec',
      iris: '#3a2b22',
    },
  },
  terminal: {
    bg: '#050a06',
    floor: '#08140b',
    floorLine: '#0f2a16',
    frame: '#1f6b35',
    frameDark: '#14482a',
    pad: '#0b2213',
    metal: '#3fbf68',
    accent: '#b6ff6b',
    avatar: '#9df2b5',
    avatarDark: '#4fae6f',
    cable: '#2a8c4a',
    label: '#b9ffc9',
    labelBg: 'rgba(3,12,5,0.9)',
    zone: { empuje: '#0e2414', traccion: '#0b2218', brazos: '#0f2416', pierna: '#0c2a17', libre: '#132814' },
    status: { ok: '#5dff8a', aviso: '#f6ff5d', riesgo: '#ff5d7a' },
    muscle: { principal: '#ff6a5d', sinergista: '#ffc25d', estabilizador: '#5dd8ff' },
    room: {
      wall: '#07160b',
      wallLow: '#051008',
      floorA: '#061209',
      floorB: '#07150b',
      speck: '#1b5530',
      seam: '#0f2a16',
      mirror: '#1f6b35',
      led: '#b6ff6b',
      decal: '#b6ff6b',
      wood: '#0f3a1d',
      plant: '#1f6b35',
      line: '#1f6b35',
      concrete: '#0b2213',
      window: '#123d20',
      screen: '#030a05',
      iron: '#07160b',
    },
    anatomy: {
      muscle: '#2c6a43',
      deep: '#173d26',
      tendon: '#78c793',
      bone: '#9fe8b6',
      skin: '#4fa76d',
      glove: '#154527',
      shoe: '#11371f',
      hair: '#0c2416',
      eye: '#c6ffd6',
      iris: '#0a2012',
    },
  },
};

/**
 * Ambiente de la sala (decisión M10 del acta, variante cromática): la luz horneada es la de día;
 * por la tarde y de noche cambian el cielo de los ventanales y el tono de las tiras LED, y la luz
 * horneada se atenúa. Las máquinas y el avatar no cambian (su luz es en tiempo real).
 */
export type Ambient = 'dia' | 'tarde' | 'noche';
export const AMBIENTS: readonly Ambient[] = ['dia', 'tarde', 'noche'];
export const AMBIENT_LABEL: Record<Ambient, string> = { dia: 'Día', tarde: 'Tarde', noche: 'Noche' };
/** Factor de la luz horneada de la sala. */
export const AMBIENT_LIGHT: Record<Ambient, number> = { dia: 1, tarde: 0.9, noche: 0.68 };

export const isAmbient = (v: unknown): v is Ambient => typeof v === 'string' && (AMBIENTS as readonly string[]).includes(v);

/** Mezcla de dos colores «#rrggbb» (t = 0 → a, t = 1 → b). */
export function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

// Una paleta derivada por combinación: la identidad se conserva (las salas no se rehacen en cada fotograma).
const derived = new WeakMap<ScenePalette, Map<string, ScenePalette>>();
function derive(p: ScenePalette, key: string, make: () => ScenePalette): ScenePalette {
  let m = derived.get(p);
  if (!m) derived.set(p, (m = new Map()));
  let out = m.get(key);
  if (!out) m.set(key, (out = make()));
  return out;
}

/** Colores de la sala para un ambiente. */
export function withAmbient(p: ScenePalette, a: Ambient): ScenePalette {
  if (a === 'dia') return p;
  return derive(p, `ambiente:${a}`, () => ({
    ...p,
    room: {
      ...p.room,
      window: a === 'tarde' ? mixHex(p.room.window, '#f29c55', 0.45) : mixHex(p.room.window, '#0a1428', 0.78),
      led: mixHex(p.room.led, a === 'tarde' ? '#ffc890' : '#ffd9a0', a === 'tarde' ? 0.25 : 0.4),
    },
  }));
}

/** Suelo de la sala de una estación con el color de su zona del gimnasio (decisión Z5 del acta). */
export function withFloorTint(p: ScenePalette, color: string, t = 0.55): ScenePalette {
  return derive(p, `suelo:${color}:${t}`, () => ({ ...p, room: { ...p.room, floorA: mixHex(p.room.floorA, color, t) } }));
}
