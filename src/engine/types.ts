import type { Vector3 } from 'three';
import type { MuscleId, MuscleRole } from '../content/muscles';
import type { Anthropometry, Segments } from './anthropometry';
import type { Side, SolvedBody } from './body';
import type { LoadSpec } from './load';
import type { MetricBase } from './metrics';
import type { ContactForce } from './moments';
import type { PhaseKind, Tempo } from './timeline';

export type Confidence = 'evidencia' | 'consenso' | 'practica';
export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  evidencia: 'Evidencia',
  consenso: 'Consenso técnico',
  practica: 'Práctica habitual',
};

export type Status = 'ok' | 'aviso' | 'riesgo';
export type WindowAt = 'siempre' | 'contraccion' | 'estiramiento' | 'movimiento';

export interface JointWindow {
  id: string;
  metric: MetricBase;
  /** Rango correcto. */
  ok: readonly [number, number];
  /** Rango de aviso (fuera de él = riesgo). Debe contener a `ok`. */
  warn: readonly [number, number];
  at: WindowAt;
  label: string;
  /** Qué hacer (señal técnica). */
  cue: string;
  /** Por qué importa. */
  why: string;
  confidence: Confidence;
  sources?: readonly string[];
  /** Solo un lado (ejercicios unilaterales); por defecto, ambos. */
  side?: Side;
}

export interface MuscleActivation {
  muscle: MuscleId;
  role: MuscleRole;
  level: 1 | 2 | 3;
}

export interface ErrorDef {
  id: string;
  label: string;
  description: string;
  consequence: string;
  /** Métricas que deben salir del rango correcto cuando se demuestra este error. */
  expect: readonly MetricBase[];
}

export interface SetupLine {
  label: string;
  value: string;
  note?: string;
}

export interface VariantContent {
  id: string;
  name: string;
  short: string;
  description: string;
  tempo: Tempo;
  muscles: readonly MuscleActivation[];
  cues: Partial<Record<PhaseKind, readonly string[]>>;
  windows: readonly JointWindow[];
  /** Ids de errores demostrables en esta variante. */
  errors: readonly string[];
}

export interface Source {
  id: string;
  cite: string;
  url?: string;
}

export interface ViewDef {
  id: string;
  label: string;
  /** Azimut en grados alrededor del eje vertical (0 = cámara en +Z mirando hacia −Z). */
  azimuth: number;
  /** Elevación en grados (35,26 = isométrica verdadera). */
  elevation: number;
}

export interface StationFrameInput {
  anthro: Anthropometry;
  seg: Segments;
  variantId: string;
  errorId: string | null;
  loadKg: number;
  /** Progreso 0 (estiramiento) → 1 (contracción), ya suavizado. */
  p: number;
  phase: PhaseKind;
}

export interface StationSolution<M> {
  body: SolvedBody;
  machine: M;
  forces: ContactForce[];
  setup: SetupLine[];
}

export interface StationLogic<M> {
  id: string;
  /** Dirección hacia la que mira el usuario (horizontal). */
  forward: Vector3;
  startAt: 'estiramiento' | 'contraccion';
  /** Inicio propio de una modalidad, si difiere del de la estación (p. ej. ejercicios que empiezan de pie). */
  startAtFor?: (variantId: string) => 'estiramiento' | 'contraccion';
  load: LoadSpec;
  defaultLoadKg: number;
  /** Caja que contiene máquina y usuario (para el encuadre automático de cámara). */
  bounds: { min: readonly [number, number, number]; max: readonly [number, number, number] };
  /** Puntos representativos de la máquina para encuadrar la cámara. */
  framePoints(machine: M): Vector3[];
  solve(input: StationFrameInput): StationSolution<M>;
}

export interface StationContent {
  id: string;
  name: string;
  short: string;
  zone: 'empuje' | 'traccion' | 'brazos' | 'pierna' | 'libre';
  family: 'cable' | 'pivote' | 'carril' | 'libre' | 'corporal';
  summary: string;
  variants: readonly VariantContent[];
  errors: readonly ErrorDef[];
  /** Métricas que se dibujan como transportadores/indicadores. */
  keyMetrics: readonly MetricBase[];
  views: readonly ViewDef[];
  sources: readonly Source[];
  generalCues: readonly string[];
}

export interface Evaluation {
  window: JointWindow;
  side?: Side;
  value: number;
  status: Status;
}
