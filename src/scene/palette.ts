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
    labelBg: 'rgba(14,17,22,0.78)',
    zone: { empuje: '#3a2a26', traccion: '#232f3d', brazos: '#2e2a3d', pierna: '#233628', libre: '#36321f' },
    status: STATUS,
    muscle: MUSCLE,
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
    labelBg: 'rgba(255,255,255,0.85)',
    zone: { empuje: '#f0ddd6', traccion: '#d7e3f0', brazos: '#e2dcf0', pierna: '#d8ebdc', libre: '#efe8cf' },
    status: { ok: '#13965a', aviso: '#c98a00', riesgo: '#e0193f' },
    muscle: MUSCLE,
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
    labelBg: 'rgba(3,12,5,0.85)',
    zone: { empuje: '#0e2414', traccion: '#0b2218', brazos: '#0f2416', pierna: '#0c2a17', libre: '#132814' },
    status: { ok: '#5dff8a', aviso: '#f6ff5d', riesgo: '#ff5d7a' },
    muscle: { principal: '#ff6a5d', sinergista: '#ffc25d', estabilizador: '#5dd8ff' },
  },
};
