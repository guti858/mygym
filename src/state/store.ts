import { create } from 'zustand';
import type { MuscleId } from '../content/muscles';
import { DEFAULT_ANTHRO, type Anthropometry } from '../engine/anthropometry';
import { findVariant } from '../engine/evaluate';
import { clampLoad } from '../engine/load';
import type { Tempo } from '../engine/timeline';
import { HUB_ISO_ELEVATION } from '../scene/hubCamera';
import { isAmbient, type Ambient, type ThemeId } from '../scene/palette';
import { getModule } from '../stations/modules';

export interface StationSettings {
  variantId: string;
  loadKg: number;
  errorId: string | null;
  tempo: Tempo;
  reps: number;
  viewId: string;
  /** Giro e inclinación de la cámara respecto a la vista (grados). */
  azimuthOffset: number;
  elevationOffset: number;
  zoom: number;
}

export type Route = { name: 'hub' } | { name: 'station'; id: string };

export interface LogLine {
  kind: 'in' | 'out' | 'err';
  text: string;
}

export interface AppState {
  route: Route;
  settings: Record<string, StationSettings>;
  anthro: Anthropometry;
  theme: ThemeId;
  /** true si el usuario eligió tema; si no, se sigue el tema del sistema/visor. */
  themeLocked: boolean;
  showMuscles: boolean;
  showGauges: boolean;
  showOverlay: boolean;
  /** Reflejo vivo de máquina y avatar en los espejos de la estación (capa opcional). */
  showReflection: boolean;
  hubRotation: number;
  /** Plano del gimnasio: inclinación (fuera de la planta), vista en planta, zoom y desplazamiento (m). */
  hubTilt: number;
  hubPlan: boolean;
  hubZoom: number;
  hubPan: readonly [number, number];
  /** Máquina elegida en el plano (su tarjeta, a un paso de abrirla). */
  hubSelected: string | null;
  /** Capas del plano: rótulos de las máquinas, nombres de zona y mini-mapa (este, solo con zoom). */
  hubLabels: boolean;
  hubZones: boolean;
  hubMiniMap: boolean;
  /** Recorrido guiado por el gimnasio: paso actual (índice de HUB_ROUTE) o null si no hay recorrido. */
  hubTour: number | null;
  /** Ambiente de la sala (luz de los ventanales y de las tiras LED). */
  ambient: Ambient;
  /**
   * Cámara con la que se abre una estación desde el plano del gimnasio (el mismo lado desde el que
   * se veía la máquina); la estación la consume al montarse y orbita hasta su vista.
   */
  entryCamera: { stationId: string; azimuth: number; elevation: number; key: number } | null;
  muscleFilter: MuscleId | null;
  consoleOpen: boolean;
  anthroOpen: boolean;
  /** Diálogo «Fuentes y avisos» (fuentes de la estación, confianza, descargo y créditos). */
  infoOpen: boolean;
  log: LogLine[];
  go(route: Route): void;
  update(stationId: string, patch: Partial<StationSettings>): void;
  setVariant(stationId: string, variantId: string): void;
  setAnthro(patch: Partial<Anthropometry>): void;
  chooseTheme(theme: ThemeId | 'auto'): void;
  set(
    patch: Partial<
      Pick<
        AppState,
        | 'theme'
        | 'showMuscles'
        | 'showGauges'
        | 'showOverlay'
        | 'showReflection'
        | 'hubRotation'
        | 'hubTilt'
        | 'hubPlan'
        | 'hubZoom'
        | 'hubPan'
        | 'hubSelected'
        | 'hubLabels'
        | 'hubZones'
        | 'hubMiniMap'
        | 'hubTour'
        | 'ambient'
        | 'muscleFilter'
        | 'consoleOpen'
        | 'anthroOpen'
        | 'infoOpen'
      >
    >,
  ): void;
  /** Plano del gimnasio a su vista de arranque (isométrica, sin zoom ni desplazamiento). */
  resetHubView(): void;
  print(...lines: LogLine[]): void;
  clearLog(): void;
}

export function defaultSettings(stationId: string, variantId?: string): StationSettings {
  const mod = getModule(stationId)!;
  const v = findVariant(mod.content, variantId ?? mod.content.variants[0]!.id);
  return {
    variantId: v.id,
    loadKg: mod.logic.defaultLoadKg,
    errorId: null,
    tempo: v.tempo,
    reps: 3,
    viewId: mod.content.views[0]!.id,
    azimuthOffset: 0,
    elevationOffset: 0,
    zoom: 1,
  };
}

/** Ajustes guardados por una versión anterior: se completan con los valores por defecto. */
function upgradeSettings(saved: Record<string, StationSettings> | undefined): Record<string, StationSettings> {
  const out: Record<string, StationSettings> = {};
  for (const [id, st] of Object.entries(saved ?? {})) if (getModule(id)) out[id] = { ...defaultSettings(id, st.variantId), ...st };
  return out;
}

const STORAGE_KEY = 'mygym:v1';

interface Persisted {
  anthro?: Anthropometry;
  theme?: ThemeId;
  themeLocked?: boolean;
  showMuscles?: boolean;
  showGauges?: boolean;
  showOverlay?: boolean;
  showReflection?: boolean;
  ambient?: Ambient;
  settings?: Record<string, StationSettings>;
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

const persisted = typeof window === 'undefined' ? {} : loadPersisted();

/** Tema del sistema o del visor que aloja la página (data-theme="light|dark" o prefers-color-scheme). */
export function hostTheme(): ThemeId {
  if (typeof window === 'undefined') return 'oscuro';
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'light') return 'claro';
  if (t === 'dark') return 'oscuro';
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'oscuro';
  } catch {
    return 'oscuro';
  }
}

export const useApp = create<AppState>((set, get) => ({
  route: { name: 'hub' },
  settings: upgradeSettings(persisted.settings),
  anthro: { ...DEFAULT_ANTHRO, ...persisted.anthro },
  theme: persisted.themeLocked && persisted.theme ? persisted.theme : hostTheme(),
  themeLocked: !!persisted.themeLocked,
  showMuscles: persisted.showMuscles ?? true,
  showGauges: persisted.showGauges ?? true,
  showOverlay: persisted.showOverlay ?? true,
  showReflection: persisted.showReflection ?? false,
  hubRotation: 0,
  hubTilt: HUB_ISO_ELEVATION,
  hubPlan: false,
  hubZoom: 1,
  hubPan: [0, 0],
  hubSelected: null,
  hubLabels: true,
  hubZones: true,
  hubMiniMap: true,
  hubTour: null,
  ambient: isAmbient(persisted.ambient) ? persisted.ambient : 'dia',
  entryCamera: null,
  muscleFilter: null,
  consoleOpen: false,
  anthroOpen: false,
  infoOpen: false,
  log: [
    { kind: 'out', text: 'MYGYM · guion articular. Escribe «ayuda» para ver los comandos.' },
  ],
  go(route) {
    if (route.name === 'station' && !getModule(route.id)) return;
    set({ route });
  },
  update(stationId, patch) {
    const mod = getModule(stationId);
    if (!mod) return;
    const cur = get().settings[stationId] ?? defaultSettings(stationId);
    const next = { ...cur, ...patch };
    if (patch.loadKg !== undefined) next.loadKg = clampLoad(mod.logic.load, patch.loadKg);
    set({ settings: { ...get().settings, [stationId]: next } });
  },
  setVariant(stationId, variantId) {
    const mod = getModule(stationId);
    if (!mod) return;
    const v = findVariant(mod.content, variantId);
    const cur = get().settings[stationId] ?? defaultSettings(stationId);
    const errorId = cur.errorId && v.errors.includes(cur.errorId) ? cur.errorId : null;
    get().update(stationId, { variantId: v.id, tempo: v.tempo, errorId });
  },
  setAnthro(patch) {
    set({ anthro: { ...get().anthro, ...patch } });
  },
  chooseTheme(theme) {
    if (theme === 'auto') set({ theme: hostTheme(), themeLocked: false });
    else set({ theme, themeLocked: true });
  },
  set(patch) {
    set(patch);
  },
  resetHubView() {
    set({ hubRotation: 0, hubTilt: HUB_ISO_ELEVATION, hubPlan: false, hubZoom: 1, hubPan: [0, 0] });
  },
  print(...lines) {
    set({ log: [...get().log, ...lines].slice(-300) });
  },
  clearLog() {
    set({ log: [] });
  },
}));

export function settingsFor(state: Pick<AppState, 'settings'>, stationId: string): StationSettings {
  return state.settings[stationId] ?? defaultSettings(stationId);
}

if (typeof window !== 'undefined') {
  useApp.subscribe((s) => {
    try {
      const data: Persisted = {
        anthro: s.anthro,
        theme: s.theme,
        themeLocked: s.themeLocked,
        showMuscles: s.showMuscles,
        showGauges: s.showGauges,
        showOverlay: s.showOverlay,
        showReflection: s.showReflection,
        ambient: s.ambient,
        settings: s.settings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* almacenamiento no disponible: la app funciona igual */
    }
  });
}

/** Fotograma actual del reproductor (separado para no re-renderizar toda la app). */
export const useFrame = create<{ frame: number; playing: boolean; rate: number; setFrame(f: number): void }>((set) => ({
  frame: 0,
  playing: true,
  rate: 1,
  setFrame: (frame) => set({ frame }),
}));
