import { Easing, interpolate } from 'remotion';
import { buildTimeline, type PhaseKind, type Segment, type Tempo, type Timeline } from '../engine/timeline';
import { SETUP_SEC } from './props';

export function stationTimeline(tempo: Tempo, reps: number, startAt: Timeline['startAt']): Timeline {
  return buildTimeline({ tempo, reps, startAt, setupSec: SETUP_SEC });
}

export function durationInFrames(tl: Timeline, fps: number): number {
  return Math.max(1, Math.ceil(tl.total * fps));
}

export interface FrameState {
  index: number;
  segment: Segment;
  kind: PhaseKind;
  rep: number;
  /** Progreso 0 (estiramiento) → 1 (contracción), suavizado. */
  p: number;
  /** Progreso local del tramo (0–1). */
  u: number;
  startFrame: number;
  endFrame: number;
}

/** Estado de la serie en un fotograma: la animación la conduce el fotograma de Remotion. */
export function frameState(frame: number, fps: number, tl: Timeline): FrameState {
  const segs = tl.segments;
  let index = segs.length - 1;
  for (let i = 0; i < segs.length; i++) {
    if (frame < Math.round(segs[i]!.end * fps)) {
      index = i;
      break;
    }
  }
  const segment = segs[index]!;
  const startFrame = Math.round(segment.start * fps);
  const endFrame = Math.max(startFrame + 1, Math.round(segment.end * fps));
  const u = interpolate(frame, [startFrame, endFrame], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const p = interpolate(frame, [startFrame, endFrame], [segment.pFrom, segment.pTo], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { index, segment, kind: segment.kind, rep: segment.rep, p, u, startFrame, endFrame };
}

/** Intensidad de activación muscular por fase (para el brillo de las carcasas). */
export function activationFor(kind: PhaseKind): number {
  switch (kind) {
    case 'concentrica':
      return 1;
    case 'pausa_contraccion':
      return 0.9;
    case 'excentrica':
      return 0.75;
    case 'pausa_estiramiento':
      return 0.45;
    case 'preparacion':
      return 0.2;
  }
}
