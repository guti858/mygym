import type { ReactElement } from 'react';
import type { StationContent, StationLogic } from '../engine/types';
import type { ScenePalette } from '../scene/palette';
import { abdAddContent } from './abd_add/content';
import { abdAddLogic, type AbdAddMachine } from './abd_add/logic';
import { AbdAddMachine3D } from './abd_add/Machine';
import { dominadasContent } from './dominadas/content';
import { dominadasLogic, type DominadasMachine } from './dominadas/logic';
import { DominadasMachine3D } from './dominadas/Machine';
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
import { mancuernasContent } from './mancuernas/content';
import { mancuernasLogic, type MancuernasMachine } from './mancuernas/logic';
import { MancuernasMachine3D } from './mancuernas/Machine';
import { poleasContent } from './poleas/content';
import { poleasLogic, type PoleasMachine } from './poleas/logic';
import { PoleasMachine3D } from './poleas/Machine';
import { prensaContent } from './prensa/content';
import { prensaLogic, type PrensaMachine } from './prensa/logic';
import { PrensaMachine3D } from './prensa/Machine';
import { remoContent } from './remo_t/content';
import { remoLogic, type RemoMachine } from './remo_t/logic';
import { RemoMachine3D } from './remo_t/Machine';

export interface StationModule<M = unknown> {
  logic: StationLogic<M>;
  content: StationContent;
  Machine: (props: { m: M; palette: ScenePalette; H: number }) => ReactElement;
}

function mod<M>(m: StationModule<M>): StationModule<unknown> {
  return m as unknown as StationModule<unknown>;
}

/** Estaciones implementadas (F3 y lotes de F4). */
export const STATION_MODULES: Record<string, StationModule> = {
  jalon: mod<JalonMachine>({ logic: jalonLogic, content: jalonContent, Machine: JalonMachine3D }),
  prensa: mod<PrensaMachine>({ logic: prensaLogic, content: prensaContent, Machine: PrensaMachine3D }),
  press_militar: mod<MilitarMachine>({ logic: militarLogic, content: militarContent, Machine: MilitarMachine3D }),
  fondos: mod<FondosMachine>({ logic: fondosLogic, content: fondosContent, Machine: FondosMachine3D }),
  peck_deck: mod<PeckMachine>({ logic: peckLogic, content: peckContent, Machine: PeckMachine3D }),
  press_banca: mod<BancaMachine>({ logic: bancaLogic, content: bancaContent, Machine: BancaMachine3D }),
  press_inclinado: mod<InclinadoMachine>({ logic: inclinadoLogic, content: inclinadoContent, Machine: InclinadoMachine3D }),
  dominadas: mod<DominadasMachine>({ logic: dominadasLogic, content: dominadasContent, Machine: DominadasMachine3D }),
  remo_t: mod<RemoMachine>({ logic: remoLogic, content: remoContent, Machine: RemoMachine3D }),
  poleas: mod<PoleasMachine>({ logic: poleasLogic, content: poleasContent, Machine: PoleasMachine3D }),
  abd_add: mod<AbdAddMachine>({ logic: abdAddLogic, content: abdAddContent, Machine: AbdAddMachine3D }),
  mancuernas: mod<MancuernasMachine>({ logic: mancuernasLogic, content: mancuernasContent, Machine: MancuernasMachine3D }),
};

export const getModule = (id: string): StationModule | undefined => STATION_MODULES[id];
