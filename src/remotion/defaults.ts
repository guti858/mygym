import { DEFAULT_ANTHRO } from '../engine/anthropometry';
import { findVariant } from '../engine/evaluate';
import { getModule } from '../stations/modules';
import type { HubCompProps, StationCompProps } from './props';

export function defaultStationProps(stationId: string, variantId?: string): StationCompProps {
  const mod = getModule(stationId)!;
  const variant = findVariant(mod.content, variantId ?? mod.content.variants[0]!.id);
  return {
    stationId,
    variantId: variant.id,
    errorId: null,
    loadKg: mod.logic.defaultLoadKg,
    anthro: DEFAULT_ANTHRO,
    tempo: variant.tempo,
    reps: 3,
    viewId: mod.content.views[0]!.id,
    azimuthOffset: 0,
    zoom: 1,
    showMuscles: true,
    showGauges: true,
    showOverlay: true,
    theme: 'oscuro',
    uiScale: 1,
  };
}

export const DEFAULT_HUB_PROPS: HubCompProps = {
  theme: 'oscuro',
  uiScale: 1,
  rotation: 0,
  zoom: 1,
  hovered: null,
  highlight: {},
  anthro: DEFAULT_ANTHRO,
};
