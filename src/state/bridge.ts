import type { PlayerRef } from '@remotion/player';
import type { FrameResult } from '../engine/evaluate';
import type { FrameState } from '../remotion/timing';
import type { Timeline } from '../engine/timeline';

/** Puente entre la consola y el reproductor/estación activos. */
export const bridge: {
  player: PlayerRef | null;
  fps: number;
  current: null | { result: FrameResult<unknown>; state: FrameState; timeline: Timeline };
} = { player: null, fps: 30, current: null };
