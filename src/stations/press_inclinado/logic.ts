import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type HandTarget, type Side, type SolvedBody } from '../../engine/body';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { DEG, clamp, lerp } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import {
  axialAt,
  backrestPlane,
  bisect,
  elbowFlexFor,
  fitToBackrest,
  floorFeet,
  seatedPelvis,
  snapPosition,
  type AxialKeys,
} from '../common';

/**
 * Press inclinado de pecho en máquina convergente. Respaldo a 30° de la vertical; las palancas
 * cuelgan de un eje alto por detrás del usuario y los manerales avanzan hacia delante y arriba
 * (60° sobre la horizontal, equivalente a un banco inclinado a 30°) mientras convergen.
 */

export interface InclinadoMachine {
  seatY: number;
  seatPos: number;
  startPos: number;
  pivot: Vector3;
  theta: number;
  theta0: number;
  theta1: number;
  handles: Record<Side, Vector3>;
  handleKind: 'prono' | 'neutro';
  stackLift: number;
  stackPlates: number;
  selectedPlates: number;
  recline: number;
}

interface VariantGeom {
  kind: 'prono' | 'neutro';
  /** Media separación de los manerales al inicio y al final (convergencia). */
  halfX0: number;
  halfX1: number;
  startFlex: number;
  pole0: readonly [number, number, number];
  pole1: readonly [number, number, number];
}

const GEOM: Record<string, VariantGeom> = {
  prono: { kind: 'prono', halfX0: 0.25, halfX1: 0.15, startFlex: 95, pole0: [0.85, -0.42, -0.45], pole1: [0.9, -0.35, -0.2] },
  neutro: { kind: 'neutro', halfX0: 0.2, halfX1: 0.12, startFlex: 95, pole0: [0.62, -0.72, -0.4], pole1: [0.6, -0.7, -0.2] },
};

export const INCLINADO_RECLINE = 30;
export const INCLINADO_BACKREST = { y: 0.77, z: -0.22 };
const BACKREST = backrestPlane(INCLINADO_RECLINE, INCLINADO_BACKREST.y, INCLINADO_BACKREST.z);
/** Dirección del empuje al inicio: 60° sobre la horizontal. */
const PUSH = new Vector3(0, Math.sin(60 * DEG), Math.cos(60 * DEG));
/** Del eje hacia el maneral al inicio (perpendicular al empuje, hacia abajo y delante). */
const RADIAL = new Vector3(0, -Math.cos(60 * DEG), Math.sin(60 * DEG));
const RADIUS = 1.1;
/** Inicio de referencia del arco (θ = 0): a la altura del pecho alto de un usuario medio. */
const ARC_START = new Vector3(0, 0.9, 0.2);
const PIVOT = ARC_START.clone().sub(RADIAL.clone().multiplyScalar(RADIUS));
const SEAT_MIN = 0.3;
const SEAT_STEP = 0.025;
const SEAT_COUNT = 16;
/** Hombro respecto al inicio del arco: manos al nivel del pecho alto. */
const GH_ABOVE_START = 0.05;
const TOP_FLEX = 12;
const START_STEP = 4 * DEG;

export const INCLINADO_LOAD: LoadSpec = { kind: 'pila', minKg: 5, maxKg: 100, stepKg: 5, ratio: 1, label: 'Pila de placas' };

const AXIAL_KEYS: AxialKeys = {
  scapElev: [
    { p: 0, v: -6 },
    { p: 1, v: -4 },
  ],
  scapProt: [
    { p: 0, v: -18 },
    { p: 0.6, v: -12 },
    { p: 1, v: -6 },
  ],
  lumbarFlex: [
    { p: 0, v: -8 },
    { p: 1, v: -8 },
  ],
  thoracicFlex: [
    { p: 0, v: -4 },
    { p: 1, v: -3 },
  ],
  neckFlex: [
    { p: 0, v: 4 },
    { p: 1, v: 4 },
  ],
  wristExt: [
    { p: 0, v: 12 },
    { p: 1, v: 6 },
  ],
};

function axialFor(p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'hombros_adelantados') over.scapProt = lerp(-10, 22, p);
  else if (errorId === 'arco_lumbar') {
    over.lumbarFlex = lerp(-26, -32, p);
    over.pelvisTilt = 10;
  }
  return axialAt(AXIAL_KEYS, p, over);
}

export function arcPoint(theta: number): Vector3 {
  return PIVOT.clone()
    .add(RADIAL.clone().multiplyScalar(Math.cos(theta) * RADIUS))
    .add(PUSH.clone().multiplyScalar(Math.sin(theta) * RADIUS));
}

function arcTangent(theta: number): Vector3 {
  return PUSH.clone().multiplyScalar(Math.cos(theta)).sub(RADIAL.clone().multiplyScalar(Math.sin(theta)));
}

function handleAt(geom: VariantGeom, side: Side, theta: number): Vector3 {
  const t = clamp((theta + 0.25) / 0.85, 0, 1);
  return arcPoint(theta).add(new Vector3(sideSign(side) * lerp(geom.halfX0, geom.halfX1, t), 0, 0));
}

export const inclinadoLogic: StationLogic<InclinadoMachine> = {
  id: 'press_inclinado',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: INCLINADO_LOAD,
  defaultLoadKg: 35,
  bounds: { min: [-0.65, 0, -1.05], max: [0.65, 2.1, 1.05] },
  framePoints: (m) => [
    new Vector3(0.6, 0, -1.0),
    new Vector3(-0.6, 0, -1.0),
    new Vector3(0.6, 0, 0.95),
    new Vector3(-0.6, 0, 0.95),
    m.pivot.clone().add(new Vector3(0.45, 0.12, 0)),
    m.pivot.clone().add(new Vector3(-0.45, 0.12, 0)),
    m.handles.L.clone().add(new Vector3(0.08, 0, 0.06)),
    m.handles.R.clone().add(new Vector3(-0.08, 0, 0.06)),
    arcPoint(m.theta1).add(new Vector3(0, 0.06, 0.06)),
  ],
  solve(input: StationFrameInput): StationSolution<InclinadoMachine> {
    const { seg, anthro, p, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM.prono!;
    const ax0 = axialFor(0, errorId);
    const ax1 = axialFor(1, errorId);
    const axP = axialFor(p, errorId);

    const place = (seatY: number, axial: AxialParams) => {
      const pelvis0 = seatedPelvis(seg, seatY, INCLINADO_RECLINE, -0.02);
      const feet0 = floorFeet(seg, pelvis0, { toeOutDeg: 12, extraHalfWidth: 0.08 });
      const pelvis = fitToBackrest(seg, anthro, pelvis0, axial, BACKREST, feet0);
      return { pelvis, feet: floorFeet(seg, pelvis, { toeOutDeg: 12, extraHalfWidth: 0.08 }) };
    };
    const bodyAt = (seatY: number, axial: AxialParams) => {
      const ref = place(seatY, axial);
      return solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: seg.ischium.clone(), axial, feet: ref.feet });
    };

    const flexAt = (body: SolvedBody, theta: number) =>
      elbowFlexFor(seg, body.arms.L.gh.distanceTo(handleAt(geom, 'L', theta)), body.axial.wristExt);
    /** Punto del arco más cercano al hombro (donde el codo queda más flexionado). */
    const nearest = (body: SolvedBody) => {
      let theta = -0.8;
      for (let t = -0.8, best = Infinity; t <= 1.2; t += 0.01) {
        const d = body.arms.L.gh.distanceTo(handleAt(geom, 'L', t));
        if (d < best) {
          best = d;
          theta = t;
        }
      }
      return theta;
    };

    // Asiento: el hombro, GH_ABOVE_START por encima del inicio del arco (el asiento solo sube o baja al usuario).
    const ghAboveSeat = bodyAt(0, ax0).arms.L.gh.y;
    let seat = snapPosition(ARC_START.y + GH_ABOVE_START - ghAboveSeat, SEAT_MIN, SEAT_STEP, SEAT_COUNT);
    // Brazos cortos: si desde esa altura el arco no se acerca lo bastante al hombro para empezar con
    // la profundidad buscada, se baja el asiento (el hombro queda más adelantado respecto al arco).
    for (let k = 0; k < 6 && seat.pos > 1; k++) {
      const b = bodyAt(seat.value, ax0);
      if (flexAt(b, nearest(b)) >= geom.startFlex + 6) break;
      seat = { pos: seat.pos - 1, value: seat.value - SEAT_STEP };
    }
    // Error: asiento bajado unos 24 cm (o al mínimo): los manerales quedan por encima de los hombros.
    if (errorId === 'asiento_bajo') seat = snapPosition(seat.value - 0.24, SEAT_MIN, SEAT_STEP, SEAT_COUNT);

    const body0 = bodyAt(seat.value, ax0);
    const body1 = bodyAt(seat.value, ax1);
    const thetaNear = nearest(body0);
    const thetaStartRaw = bisect(thetaNear, 1.2, (t) => flexAt(body0, t) <= geom.startFlex);
    const startPos = Math.max(1, Math.round((thetaStartRaw + 0.8) / START_STEP) + 1);
    const theta0 = -0.8 + (startPos - 1) * START_STEP;
    const theta1 = bisect(theta0, 1.3, (t) => flexAt(body1, t) <= TOP_FLEX);
    const theta = lerp(theta0, theta1, p);

    const ref = place(seat.value, axP);
    const pre = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: seg.ischium.clone(), axial: axP, feet: ref.feet });
    const hands = {} as Record<Side, HandTarget>;
    const handles = {} as Record<Side, Vector3>;
    const push = arcTangent(theta);
    for (const side of SIDES) {
      const s = sideSign(side);
      const grip = handleAt(geom, side, theta);
      let pole = pre.thorax.dir(
        s * lerp(geom.pole0[0], geom.pole1[0], p),
        lerp(geom.pole0[1], geom.pole1[1], p),
        lerp(geom.pole0[2], geom.pole1[2], p),
      );
      if (errorId === 'codos_90') pole = pre.thorax.dir(s, 0.45, -0.15);
      const palm = geom.kind === 'prono' ? push.clone() : pre.thorax.dir(-s, 0, 0.2);
      hands[side] = { grip, pole: pole.normalize(), palm: palm.normalize() };
      handles[side] = grip;
    }
    const body = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: seg.ischium.clone(), axial: axP, feet: ref.feet, hands });

    const load = describeLoad(INCLINADO_LOAD, input.loadKg);
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: handles[side].clone(),
      force: push.clone().multiplyScalar(-load.forceN / 2),
    }));
    const gripCm = Math.round(geom.halfX0 * 200);
    return {
      body,
      machine: {
        seatY: seat.value,
        seatPos: seat.pos,
        startPos,
        pivot: PIVOT.clone(),
        theta,
        theta0,
        theta1,
        handles,
        handleKind: geom.kind,
        stackLift: Math.max(0, (theta - theta0) * RADIUS * 0.5),
        stackPlates: 20,
        selectedPlates: Math.round(input.loadKg / 5),
        recline: INCLINADO_RECLINE,
      },
      forces,
      setup: [
        { label: 'Asiento', value: `Posición ${seat.pos} (${Math.round(seat.value * 100)} cm)`, note: 'Al empezar, los manerales a la altura del pecho alto (clavícula–esternón)' },
        { label: 'Palanca de inicio', value: `Posición ${startPos}`, note: 'Codos ligeramente por detrás del tronco, sin forzar el estiramiento' },
        { label: 'Respaldo', value: `${INCLINADO_RECLINE}° respecto a la vertical`, note: 'Espalda y cabeza apoyadas; escápulas juntas y abajo' },
        {
          label: 'Agarre',
          value: geom.kind === 'prono' ? `Prono, ${gripCm} cm entre manos al inicio` : `Neutro (palmas enfrentadas), ${gripCm} cm entre manos al inicio`,
        },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
