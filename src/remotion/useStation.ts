import { useMemo } from 'react';
import { computeSegments } from '../engine/anthropometry';
import { evaluateFrame, findVariant } from '../engine/evaluate';
import { getModule } from '../stations/modules';
import type { StationCompProps } from './props';
import { durationInFrames, frameState, stationTimeline } from './timing';

/** Todo lo necesario para dibujar (o describir) un fotograma de una estación. */
export function useStationFrame(props: StationCompProps, frame: number, fps: number) {
  const mod = getModule(props.stationId);
  if (!mod) throw new Error(`Estación no implementada: ${props.stationId}`);
  const seg = useMemo(() => computeSegments(props.anthro), [props.anthro]);
  const variant = findVariant(mod.content, props.variantId);
  const tempo = props.tempo;
  const timeline = useMemo(
    () => stationTimeline(tempo, props.reps, mod.logic.startAt),
    [tempo, props.reps, mod.logic.startAt],
  );
  const state = frameState(frame, fps, timeline);
  const result = evaluateFrame(mod.logic, mod.content, {
    anthro: props.anthro,
    seg,
    variantId: variant.id,
    errorId: props.errorId,
    loadKg: props.loadKg,
    p: state.p,
    phase: state.kind,
  });
  return { mod, seg, variant, timeline, state, result, total: durationInFrames(timeline, fps) };
}
