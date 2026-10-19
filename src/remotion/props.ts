import type { Anthropometry } from '../engine/anthropometry';
import type { Tempo } from '../engine/timeline';
import type { ThemeId } from '../scene/palette';

export const FPS = 30;
export const SETUP_SEC = 2;
export const COMP_W = 1200;
export const COMP_H = 900;

export type StationCompProps = {
  stationId: string;
  variantId: string;
  errorId: string | null;
  loadKg: number;
  anthro: Anthropometry;
  tempo: Tempo;
  reps: number;
  viewId: string;
  azimuthOffset: number;
  zoom: number;
  showMuscles: boolean;
  showGauges: boolean;
  showOverlay: boolean;
  theme: ThemeId;
  /** Escala de rótulos (1 en escritorio, mayor en pantallas pequeñas). */
  uiScale: number;
};

export type HubCompProps = {
  theme: ThemeId;
  uiScale: number;
  rotation: number;
  zoom: number;
  hovered: string | null;
  highlight: Record<string, 'principal' | 'secundario'>;
  anthro: Anthropometry;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
};
