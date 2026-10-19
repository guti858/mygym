import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type HandTarget, type Side } from '../../engine/body';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { DEG, lerp } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import {
  axialAt,
  backrestPlane,
  chestPoint,
  fitToBackrest,
  floorFeet,
  reachFor,
  seatedPelvis,
  snapPosition,
  type AxialKeys,
} from '../common';

/**
 * Peck-deck: cada brazo de la máquina gira alrededor de un eje vertical que, bien regulado,
 * pasa por el hombro. Con el codo semiflexionado fijo, la mano describe un arco horizontal:
 * aducción horizontal (aperturas, de espaldas al respaldo) o abducción horizontal (pájaro
 * invertido, con el pecho contra la almohadilla).
 */

export type PeckMode = 'aperturas' | 'pajaro';

export interface PeckMachine {
  mode: PeckMode;
  seatY: number;
  seatPos: number;
  /** Ejes verticales de giro (x, z). */
  axes: Record<Side, Vector3>;
  /** Ángulo de cada brazo respecto al plano frontal (0 = lateral, 90° = al frente). */
  phi: number;
  handles: Record<Side, Vector3>;
  stackLift: number;
  stackPlates: number;
  selectedPlates: number;
}

export const PECK_HANDLE_Y = 0.96;
const SEAT_MIN = 0.3;
const SEAT_STEP = 0.025;
const SEAT_COUNT = 16;
const ELBOW_FLEX = 20;
/** Elevación del brazo (desde colgando): los manerales algo por debajo del hombro. */
const ARM_ELEV = 82;
export const PECK_BACK = { y: 0.75, z: -0.13 };
const BACKREST = backrestPlane(3, PECK_BACK.y, PECK_BACK.z);
/** Almohadilla de pecho del pájaro invertido (plano vertical delante del usuario). */
export const PECK_CHEST_Z = 0.2;
const CHEST_PAD = { point: new Vector3(0, PECK_HANDLE_Y - 0.06, PECK_CHEST_Z), normal: new Vector3(0, 0, -1) };

export const PECK_LOAD: LoadSpec = { kind: 'pila', minKg: 5, maxKg: 80, stepKg: 5, ratio: 1, label: 'Pila de placas' };

const KEYS: Record<PeckMode, AxialKeys> = {
  aperturas: {
    scapProt: [
      { p: 0, v: -12 },
      { p: 1, v: -4 },
    ],
    scapElev: [
      { p: 0, v: -4 },
      { p: 1, v: -3 },
    ],
    lumbarFlex: [{ p: 0, v: -5 }],
    neckFlex: [{ p: 0, v: 3 }],
    wristExt: [{ p: 0, v: 6 }],
  },
  pajaro: {
    scapProt: [
      { p: 0, v: 0 },
      { p: 1, v: -10 },
    ],
    scapElev: [
      { p: 0, v: -3 },
      { p: 1, v: -5 },
    ],
    lumbarFlex: [{ p: 0, v: -4 }],
    neckFlex: [{ p: 0, v: 4 }],
    wristExt: [{ p: 0, v: 4 }],
  },
};

function axialFor(mode: PeckMode, p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'hombros_adelantados') over.scapProt = lerp(-6, 24, p);
  else if (errorId === 'encogimiento') over.scapElev = lerp(10, 20, p);
  return axialAt(KEYS[mode], p, over);
}

/** Dirección horizontal del brazo para un ángulo φ desde el plano frontal. */
const armDir = (s: number, phi: number) => new Vector3(s * Math.cos(phi * DEG), 0, Math.sin(phi * DEG));
/** Sentido de cierre (aducción horizontal) del arco. */
const closeDir = (s: number, phi: number) => new Vector3(-s * Math.sin(phi * DEG), 0, Math.cos(phi * DEG));

export const peckLogic: StationLogic<PeckMachine> = {
  id: 'peck_deck',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: PECK_LOAD,
  defaultLoadKg: 30,
  bounds: { min: [-0.85, 0, -0.75], max: [0.85, 2.15, 0.85] },
  framePoints: (m) => [
    new Vector3(0.8, 0, -0.7),
    new Vector3(-0.8, 0, -0.7),
    new Vector3(0.8, 0, 0.8),
    new Vector3(-0.8, 0, 0.8),
    new Vector3(0, 2.1, m.mode === 'aperturas' ? -0.4 : 0.45),
    m.handles.L.clone().add(new Vector3(0.05, 0.3, 0)),
    m.handles.R.clone().add(new Vector3(-0.05, 0.3, 0)),
  ],
  solve(input: StationFrameInput): StationSolution<PeckMachine> {
    const { seg, anthro, p, errorId } = input;
    const mode: PeckMode = input.variantId === 'pajaro' ? 'pajaro' : 'aperturas';
    const axial = axialFor(mode, p, errorId);
    const ax0 = axialFor(mode, 0, errorId);

    const recline = mode === 'aperturas' ? 3 : -6;
    const place = (seatY: number, ax: AxialParams) => {
      const pelvis0 = seatedPelvis(seg, seatY, recline, mode === 'aperturas' ? -0.02 : 0.02);
      const feet0 = floorFeet(seg, pelvis0, { toeOutDeg: 10, extraHalfWidth: 0.06 });
      const pelvis =
        mode === 'aperturas'
          ? fitToBackrest(seg, anthro, pelvis0, ax, BACKREST, feet0)
          : fitToBackrest(seg, anthro, pelvis0, ax, CHEST_PAD, feet0, chestPoint);
      return { pelvis, feet: floorFeet(seg, pelvis, { toeOutDeg: 10, extraHalfWidth: 0.06 }) };
    };
    const reach = reachFor(seg, ELBOW_FLEX, ax0.wristExt);
    const drop = reach * Math.cos(ARM_ELEV * DEG);
    const probe = (() => {
      const r = place(0, ax0);
      return solveBody({ seg, anthro, pelvisRef: r.pelvis, pelvisPivot: seg.ischium.clone(), axial: ax0, feet: r.feet });
    })();
    let seat = snapPosition(PECK_HANDLE_Y + drop - probe.arms.L.gh.y, SEAT_MIN, SEAT_STEP, SEAT_COUNT);
    // Error: asiento bajado unos 24 cm (o al mínimo): los manerales quedan por encima de los hombros.
    if (errorId === 'asiento') seat = snapPosition(seat.value - 0.24, SEAT_MIN, SEAT_STEP, SEAT_COUNT);

    const ref = place(seat.value, axial);
    // Eje de giro de cada brazo, fijo, sobre la vertical del hombro en una postura de referencia con
    // técnica ideal (inicio de las aperturas; 60 % del pájaro): la mano recorre un arco horizontal a la
    // altura de los manerales. Lo que se mueva el hombro (escápulas, errores) lo absorbe el codo.
    const axRef = axialFor(mode, mode === 'aperturas' ? 0 : 0.6, null);
    const refAxes = place(seat.value, axRef);
    const atRef = solveBody({ seg, anthro, pelvisRef: refAxes.pelvis, pelvisPivot: seg.ischium.clone(), axial: axRef, feet: refAxes.feet });
    const axes = { L: atRef.arms.L.gh.clone(), R: atRef.arms.R.gh.clone() };
    const dhFor = (gh: Vector3) => {
      const dy = Math.min(reach * 0.98, gh.y - PECK_HANDLE_Y);
      return Math.sqrt(Math.max(0.01, reach * reach - dy * dy));
    };
    // Ángulos del arco: aperturas desde el plano del cuerpo hasta juntar las manos; el pájaro al revés.
    const meet = Math.acos(-Math.min(0.95, (Math.abs(axes.L.x) - 0.06) / dhFor(axes.L))) / DEG;
    const open = errorId === 'detras' ? -30 : mode === 'aperturas' ? 6 : 2;
    const phi = mode === 'aperturas' ? lerp(open, meet, p) : lerp(meet - 4, open, p);

    const hands = {} as Record<Side, HandTarget>;
    const handles = {} as Record<Side, Vector3>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const axis = axes[side];
      const grip = new Vector3(axis.x, PECK_HANDLE_Y, axis.z).add(armDir(s, phi).multiplyScalar(dhFor(axis)));
      const t = closeDir(s, phi);
      const pole = mode === 'aperturas' ? t.clone().negate().add(new Vector3(0, -0.55, 0)) : t.clone().negate().add(new Vector3(0, 0.25, 0));
      hands[side] = { grip, pole: pole.normalize(), palm: t.clone() };
      handles[side] = grip;
    }
    const body = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: seg.ischium.clone(), axial, feet: ref.feet, hands });

    const load = describeLoad(PECK_LOAD, input.loadKg);
    const forces: ContactForce[] = SIDES.map((side) => {
      const t = closeDir(sideSign(side), phi);
      // La máquina resiste el movimiento: contra el cierre (aperturas) o contra la apertura (pájaro).
      return { limb: 'arm', side, point: handles[side].clone(), force: t.multiplyScalar((mode === 'aperturas' ? -1 : 1) * (load.forceN / 2)) };
    });
    const travel = mode === 'aperturas' ? phi - open : meet - 4 - phi;
    return {
      body,
      machine: {
        mode,
        seatY: seat.value,
        seatPos: seat.pos,
        axes,
        phi,
        handles,
        stackLift: Math.max(0, travel * DEG * 0.12),
        stackPlates: 16,
        selectedPlates: Math.round(input.loadKg / 5),
      },
      forces,
      setup: [
        { label: 'Asiento', value: `Posición ${seat.pos} (${Math.round(seat.value * 100)} cm)`, note: 'Manerales a la altura del pecho medio, hombros un poco por encima de las manos' },
        {
          label: 'Brazos de la máquina',
          value: mode === 'aperturas' ? 'Inicio en el plano del cuerpo (no por detrás)' : 'Inicio con las manos juntas delante',
          note: 'El eje de giro de cada brazo, sobre la vertical del hombro',
        },
        {
          label: 'Posición',
          value: mode === 'aperturas' ? 'Espalda contra el respaldo' : 'Pecho contra la almohadilla',
          note: 'Codos semiflexionados (~20°) y fijos durante toda la serie',
        },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
