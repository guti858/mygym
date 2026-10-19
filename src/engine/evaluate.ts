import { SIDES, type Side } from './body';
import { LIMB_METRICS, type Metrics } from './metrics';
import { jointMoments } from './moments';
import { measure } from './metrics';
import type { PhaseKind } from './timeline';
import type {
  Evaluation,
  JointWindow,
  StationContent,
  StationFrameInput,
  StationLogic,
  Status,
  VariantContent,
} from './types';

export const STATUS_RANK: Record<Status, number> = { ok: 0, aviso: 1, riesgo: 2 };

export function worst(statuses: Iterable<Status>): Status {
  let w: Status = 'ok';
  for (const s of statuses) if (STATUS_RANK[s] > STATUS_RANK[w]) w = s;
  return w;
}

export function classify(value: number, ok: readonly [number, number], warn: readonly [number, number]): Status {
  if (value >= ok[0] && value <= ok[1]) return 'ok';
  if (value >= warn[0] && value <= warn[1]) return 'aviso';
  return 'riesgo';
}

export function windowActive(w: JointWindow, p: number, phase: PhaseKind): boolean {
  switch (w.at) {
    case 'siempre':
      return true;
    case 'contraccion':
      return p >= 0.97;
    case 'estiramiento':
      return p <= 0.03;
    case 'movimiento':
      return phase === 'concentrica' || phase === 'excentrica';
  }
}

export function evaluateWindows(
  windows: readonly JointWindow[],
  metrics: Metrics,
  p: number,
  phase: PhaseKind,
): Evaluation[] {
  const out: Evaluation[] = [];
  for (const w of windows) {
    if (!windowActive(w, p, phase)) continue;
    const sides: (Side | undefined)[] = LIMB_METRICS.has(w.metric) ? [...SIDES] : [undefined];
    for (const side of sides) {
      const key = side ? `${w.metric}.${side}` : w.metric;
      const value = metrics[key];
      if (value === undefined) continue;
      out.push({ window: w, side, value, status: classify(value, w.ok, w.warn) });
    }
  }
  return out;
}

export function findVariant(content: StationContent, id: string): VariantContent {
  return content.variants.find((v) => v.id === id) ?? content.variants[0]!;
}

/** Pipeline completo de un fotograma: cinemática → métricas → ventanas → momentos. */
export function evaluateFrame<M>(logic: StationLogic<M>, content: StationContent, input: StationFrameInput) {
  const variant = findVariant(content, input.variantId);
  const errorId = input.errorId && variant.errors.includes(input.errorId) ? input.errorId : null;
  const solution = logic.solve({ ...input, variantId: variant.id, errorId });
  const metrics = measure(solution.body, { forward: logic.forward });
  const evaluations = evaluateWindows(variant.windows, metrics, input.p, input.phase);
  const moments = jointMoments(solution.body, solution.forces);
  return { ...solution, variant, errorId, metrics, evaluations, moments, status: worst(evaluations.map((e) => e.status)) };
}

export type FrameResult<M> = ReturnType<typeof evaluateFrame<M>>;
