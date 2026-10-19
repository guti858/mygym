import type { ReactElement } from 'react';
import type { StationContent, StationLogic } from '../engine/types';
import type { ScenePalette } from '../scene/palette';
import { fondosContent } from './fondos/content';
import { fondosLogic, type FondosMachine } from './fondos/logic';
import { FondosMachine3D } from './fondos/Machine';
import { jalonContent } from './jalon/content';
import { jalonLogic, type JalonMachine } from './jalon/logic';
import { JalonMachine3D } from './jalon/Machine';
import { bancaContent } from './press_banca/content';
import { bancaLogic, type BancaMachine } from './press_banca/logic';
import { BancaMachine3D } from './press_banca/Machine';
import { inclinadoContent } from './press_inclinado/content';
import { inclinadoLogic, type InclinadoMachine } from './press_inclinado/logic';
import { InclinadoMachine3D } from './press_inclinado/Machine';
import { militarContent } from './press_militar/content';
import { militarLogic, type MilitarMachine } from './press_militar/logic';
import { MilitarMachine3D } from './press_militar/Machine';
import { peckContent } from './peck_deck/content';
import { peckLogic, type PeckMachine } from './peck_deck/logic';
import { PeckMachine3D } from './peck_deck/Machine';
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
  press_militar: mod<MilitarMachine>({ logic: militarLogic, content: militarContent, Machine: MilitarMachine3D }),
  fondos: mod<FondosMachine>({ logic: fondosLogic, content: fondosContent, Machine: FondosMachine3D }),
  peck_deck: mod<PeckMachine>({ logic: peckLogic, content: peckContent, Machine: PeckMachine3D }),
  press_banca: mod<BancaMachine>({ logic: bancaLogic, content: bancaContent, Machine: BancaMachine3D }),
  press_inclinado: mod<InclinadoMachine>({ logic: inclinadoLogic, content: inclinadoContent, Machine: InclinadoMachine3D }),
};

export const getModule = (id: string): StationModule | undefined => STATION_MODULES[id];
