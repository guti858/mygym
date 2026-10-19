import type { ReactElement } from 'react';
import type { StationContent, StationLogic } from '../engine/types';
import type { ScenePalette } from '../scene/palette';
import { jalonContent } from './jalon/content';
import { jalonLogic, type JalonMachine } from './jalon/logic';
import { JalonMachine3D } from './jalon/Machine';
import { prensaContent } from './prensa/content';
import { prensaLogic, type PrensaMachine } from './prensa/logic';
import { PrensaMachine3D } from './prensa/Machine';

export interface StationModule<M = unknown> {
  logic: StationLogic<M>;
  content: StationContent;
  Machine: (props: { m: M; palette: ScenePalette; H: number }) => ReactElement;
}

function mod<M>(m: StationModule<M>): StationModule<unknown> {
  return m as unknown as StationModule<unknown>;
}

/** Estaciones implementadas (rebanada vertical F3). */
export const STATION_MODULES: Record<string, StationModule> = {
  jalon: mod<JalonMachine>({ logic: jalonLogic, content: jalonContent, Machine: JalonMachine3D }),
  prensa: mod<PrensaMachine>({ logic: prensaLogic, content: prensaContent, Machine: PrensaMachine3D }),
};

export const getModule = (id: string): StationModule | undefined => STATION_MODULES[id];
