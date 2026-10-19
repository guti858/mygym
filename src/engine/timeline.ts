/**
 * Línea de tiempo de una serie. El progreso `p` va de 0 (posición de ESTIRAMIENTO del músculo
 * principal) a 1 (posición de CONTRACCIÓN). Tempo en notación de 4 cifras:
 * excéntrica – pausa en estiramiento – concéntrica – pausa en contracción.
 */
export type PhaseKind =
  | 'preparacion'
  | 'excentrica'
  | 'pausa_estiramiento'
  | 'concentrica'
  | 'pausa_contraccion';

export const PHASE_LABEL: Record<PhaseKind, string> = {
  preparacion: 'Preparación',
  excentrica: 'Excéntrica',
  pausa_estiramiento: 'Pausa en estiramiento',
  concentrica: 'Concéntrica',
  pausa_contraccion: 'Pausa en contracción',
};

export interface Tempo {
  excentrica: number;
  pausaEstiramiento: number;
  concentrica: number;
  pausaContraccion: number;
}

export const tempoToString = (t: Tempo) =>
  [t.excentrica, t.pausaEstiramiento, t.concentrica, t.pausaContraccion].join('-');

export function parseTempo(text: string): Tempo | null {
  const parts = text.split(/[-–\s/]+/).filter(Boolean).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 10)) return null;
  const [a, b, c, d] = parts as [number, number, number, number];
  if (a + c === 0) return null;
  return { excentrica: a, pausaEstiramiento: b, concentrica: c, pausaContraccion: d };
}

export interface Segment {
  kind: PhaseKind;
  rep: number;
  start: number;
  end: number;
  pFrom: number;
  pTo: number;
}

export interface Timeline {
  segments: Segment[];
  total: number;
  startAt: 'estiramiento' | 'contraccion';
}

export function buildTimeline(opts: {
  tempo: Tempo;
  reps: number;
  startAt: 'estiramiento' | 'contraccion';
  setupSec: number;
}): Timeline {
  const { tempo, reps, startAt, setupSec } = opts;
  const segments: Segment[] = [];
  let t = 0;
  const p0 = startAt === 'estiramiento' ? 0 : 1;
  const push = (kind: PhaseKind, rep: number, dur: number, pFrom: number, pTo: number) => {
    if (dur <= 0) return;
    segments.push({ kind, rep, start: t, end: t + dur, pFrom, pTo });
    t += dur;
  };
  push('preparacion', 0, setupSec, p0, p0);
  for (let rep = 1; rep <= reps; rep++) {
    if (startAt === 'contraccion') {
      push('excentrica', rep, tempo.excentrica, 1, 0);
      push('pausa_estiramiento', rep, tempo.pausaEstiramiento, 0, 0);
      push('concentrica', rep, tempo.concentrica, 0, 1);
      push('pausa_contraccion', rep, tempo.pausaContraccion, 1, 1);
    } else {
      push('concentrica', rep, tempo.concentrica, 0, 1);
      push('pausa_contraccion', rep, tempo.pausaContraccion, 1, 1);
      push('excentrica', rep, tempo.excentrica, 1, 0);
      push('pausa_estiramiento', rep, tempo.pausaEstiramiento, 0, 0);
    }
  }
  return { segments, total: t, startAt };
}

export interface TimelineSample {
  index: number;
  segment: Segment;
  /** Progreso local dentro del tramo (0–1, sin suavizar). */
  u: number;
}

export function locate(tl: Timeline, tSec: number): TimelineSample {
  const segs = tl.segments;
  const last = segs.length - 1;
  for (let i = 0; i <= last; i++) {
    const s = segs[i]!;
    if (tSec < s.end || i === last) {
      const dur = s.end - s.start;
      const u = dur > 0 ? Math.min(1, Math.max(0, (tSec - s.start) / dur)) : 1;
      return { index: i, segment: s, u };
    }
  }
  throw new Error('Línea de tiempo vacía');
}
