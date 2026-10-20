import type { Anthropometry } from '../engine/anthropometry';
import type { Tempo } from '../engine/timeline';
import type { ThemeId } from '../scene/palette';

export const FPS = 30;
export const SETUP_SEC = 2;
export const COMP_W = 1200;
export const COMP_H = 900;

/** Id de la composición de una estación y variante (Remotion solo admite letras, números y guiones). */
export const compositionId = (station: string, variant: string) => `${station}-${variant}`.replace(/_/g, '-');

export type StationCompProps = {
  stationId: string;
  variantId: string;
  errorId: string | null;
  loadKg: number;
  anthro: Anthropometry;
  tempo: Tempo;
  reps: number;
  viewId: string;
  /** Giro alrededor del eje vertical respecto a la vista (grados). */
  azimuthOffset: number;
  /** Inclinación respecto a la vista (grados; la elevación final queda entre 0° y 89°). */
  elevationOffset?: number;
  /**
   * Cámara absoluta (azimut y elevación en grados). La app la interpola entre vistas y al
   * arrastrar; si falta, se usa la vista con sus giros (vídeo exportado).
   */
  cam?: { azimuth: number; elevation: number };
  zoom: number;
  showMuscles: boolean;
  showGauges: boolean;
  showOverlay: boolean;
  theme: ThemeId;
  /** Escala de rótulos (1 con el vídeo a tamaño completo, mayor cuanto más pequeño se muestra). */
  uiScale: number;
  /**
   * Dentro de la app, que ya muestra alrededor el nombre, la fase, la repetición y el progreso:
   * el reproductor omite la tarjeta de título y deja abajo solo la pauta de técnica.
   */
  embedded?: boolean;
};

export type HubCompProps = {
  theme: ThemeId;
  uiScale: number;
  /** Giros de 90° (admite fracciones mientras la sala gira). Azimut = −45° + 90° × rotation. */
  rotation: number;
  zoom: number;
  hovered: string | null;
  highlight: Record<string, 'principal' | 'secundario'>;
  anthro: Anthropometry;
  /** Máquina elegida y su posición en el plano (fracción del ancho y el alto de la composición). */
  onSelect?: (id: string, point?: { x: number; y: number }) => void;
  onHover?: (id: string | null) => void;
};
