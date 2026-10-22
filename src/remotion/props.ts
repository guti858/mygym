import type { Anthropometry } from '../engine/anthropometry';
import type { Tempo } from '../engine/timeline';
import type { HubView } from '../scene/hubCamera';
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
   * Dentro de la app, que ya muestra alrededor el nombre, la fase, la pauta, la repetición y los
   * ángulos: el reproductor omite la tarjeta de título, la caja de pauta y la leyenda de ángulos, y
   * deja abajo sitio para la barra de vista. A pantalla completa la app vuelve al aspecto del vídeo.
   */
  embedded?: boolean;
};

export type HubCompProps = {
  theme: ThemeId;
  uiScale: number;
  /** Giros de 90° (admite fracciones mientras la sala gira). Azimut = −45° + 90° × rotation. */
  rotation: number;
  zoom: number;
  /**
   * Cámara completa (giro, inclinación, zoom y desplazamiento). La app la pasa ya interpolada; si
   * falta, la isométrica del giro `rotation` con `zoom` (vídeo exportado).
   */
  view?: HubView;
  hovered: string | null;
  highlight: Record<string, 'principal' | 'secundario'>;
  /** Máquina elegida (anillo y rótulo destacados; el resto, atenuado). */
  selected?: string | null;
  /** Máquina a la que se acerca la cámara al abrirla: el resto se oscurece más. */
  focus?: string | null;
  /** Rótulos de las máquinas y nombres de zona (por defecto, visibles). */
  showLabels?: boolean;
  showZones?: boolean;
  /** Dentro de la app: abajo queda sitio para la barra de vista. */
  embedded?: boolean;
  /** Resolución del lienzo respecto a la composición (la app la ajusta a la pantalla). */
  dpr?: number;
  anthro: Anthropometry;
  /** Máquina pulsada y su posición en el plano (fracción del ancho y el alto de la composición). */
  onSelect?: (id: string, point?: { x: number; y: number }) => void;
  onHover?: (id: string | null) => void;
  /** Clic en el plano fuera de cualquier máquina. */
  onMiss?: () => void;
};
