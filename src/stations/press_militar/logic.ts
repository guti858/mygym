import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type HandTarget, type Side } from '../../engine/body';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { DEG, lerp } from '../../engine/math';
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
 * Press militar en máquina: palanca que gira alrededor de un eje transversal por detrás del
 * respaldo. Los manerales describen un arco que sube y se retrasa ligeramente hasta quedar
 * sobre los hombros. El asiento se elige para que los hombros queden 12 cm por debajo del
 * inicio del arco; el recorrido de cada usuario va de la profundidad objetivo del codo a la
 * casi extensión.
 */

export interface MilitarMachine {
  seatY: number;
  seatPos: number;
  startPos: number;
  pivot: Vector3;
  /** Ángulo de la palanca (rad) en el fotograma, inicio y final del recorrido del usuario. */
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
  /** Media separación de los manerales (m): los de la máquina no cambian con el usuario. */
  halfX: number;
  /** Flexión de codo al inicio (estiramiento). */
  startFlex: number;
  /** Polo del codo en el sistema del tórax, al inicio y al final. */
  pole0: readonly [number, number, number];
  pole1: readonly [number, number, number];
}

const GEOM: Record<string, VariantGeom> = {
  prono: { kind: 'prono', halfX: 0.27, startFlex: 122, pole0: [1, -0.55, 0.2], pole1: [1, -0.15, 0.1] },
  neutro: { kind: 'neutro', halfX: 0.2, startFlex: 122, pole0: [0.8, -0.6, 0.32], pole1: [0.8, -0.2, 0.3] },
};

export const MILITAR_RECLINE = 5;
export const MILITAR_BACKREST = { y: 0.9, z: -0.14 };
/** Eje de la palanca y radio del arco de los manerales. */
const PIVOT = new Vector3(0, 1.24, -0.86);
const RADIUS = 1.02;
const SEAT_MIN = 0.36;
const SEAT_STEP = 0.025;
const SEAT_COUNT = 14;
/** Altura objetivo del hombro respecto al eje de la palanca. */
const GH_BELOW_PIVOT = 0.12;
const BACKREST = backrestPlane(MILITAR_RECLINE, MILITAR_BACKREST.y, MILITAR_BACKREST.z);
const TOP_FLEX = 12;
const START_STEP = 4 * DEG;

export const MILITAR_LOAD: LoadSpec = { kind: 'pila', minKg: 5, maxKg: 90, stepKg: 5, ratio: 1, label: 'Pila de placas' };

const AXIAL_KEYS: AxialKeys = {
  scapElev: [
    { p: 0, v: -2 },
    { p: 0.5, v: 4 },
    { p: 1, v: 9 },
  ],
  scapProt: [
    { p: 0, v: -4 },
    { p: 1, v: 4 },
  ],
  lumbarFlex: [
    { p: 0, v: -4 },
    { p: 1, v: -5 },
  ],
  thoracicFlex: [
    { p: 0, v: 0 },
    { p: 1, v: -2 },
  ],
  neckFlex: [
    { p: 0, v: 2 },
    { p: 1, v: 0 },
  ],
  wristExt: [
    { p: 0, v: 10 },
    { p: 1, v: 6 },
  ],
};

function axialFor(p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'arco_lumbar') {
    over.lumbarFlex = lerp(-16, -26, p);
    over.pelvisTilt = 8;
  } else if (errorId === 'encogimiento') {
    over.scapElev = lerp(8, 27, p);
  }
  return axialAt(AXIAL_KEYS, p, over);
}

/** Punto del arco de los manerales (sin desplazamiento lateral). */
export function arcPoint(theta: number): Vector3 {
  return PIVOT.clone().add(new Vector3(0, Math.sin(theta) * RADIUS, Math.cos(theta) * RADIUS));
}

function arcTangent(theta: number): Vector3 {
  return new Vector3(0, Math.cos(theta), -Math.sin(theta));
}

/** Los manerales convergen 3 cm a lo largo del recorrido completo de la máquina. */
function handleAt(geom: VariantGeom, side: Side, theta: number): Vector3 {
  const conv = 0.03 * Math.min(1, Math.max(0, (theta + 0.2) / 1.0));
  return arcPoint(theta).add(new Vector3(sideSign(side) * (geom.halfX - conv), 0, 0));
}

function seatFor(ghAboveSeat: number) {
  return snapPosition(PIVOT.y - GH_BELOW_PIVOT - ghAboveSeat, SEAT_MIN, SEAT_STEP, SEAT_COUNT);
}

export const militarLogic: StationLogic<MilitarMachine> = {
  id: 'press_militar',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: MILITAR_LOAD,
  defaultLoadKg: 30,
  bounds: { min: [-0.6, 0, -1.05], max: [0.6, 2.2, 0.75] },
  framePoints: (m) => [
    new Vector3(0.55, 0, -1.0),
    new Vector3(-0.55, 0, -1.0),
    new Vector3(0.55, 0, 0.7),
    new Vector3(-0.55, 0, 0.7),
    m.pivot.clone().add(new Vector3(0.4, 0.1, 0)),
    m.pivot.clone().add(new Vector3(-0.4, 0.1, 0)),
    m.handles.L.clone().add(new Vector3(0.08, 0.05, 0)),
    m.handles.R.clone().add(new Vector3(-0.08, 0.05, 0)),
    arcPoint(m.theta1).add(new Vector3(0, 0.08, 0)),
  ],
  solve(input: StationFrameInput): StationSolution<MilitarMachine> {
    const { seg, anthro, p, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM.prono!;
    const ax0 = axialFor(0, errorId);
    const ax1 = axialFor(1, errorId);
    const axP = axialFor(p, errorId);

    // Altura del hombro sobre el asiento (postura de referencia) → posición del asiento.
    const probePelvis = seatedPelvis(seg, 0, MILITAR_RECLINE, -0.04);
    const probe = solveBody({ seg, anthro, pelvisRef: probePelvis, pelvisPivot: seg.ischium.clone(), axial: ax0, feet: floorFeet(seg, probePelvis, { floorY: -0.5 }) });
    const seat = seatFor(probe.arms.L.gh.y);

    const place = (axial: AxialParams) => {
      const pelvis0 = seatedPelvis(seg, seat.value, MILITAR_RECLINE, -0.04);
      const feet0 = floorFeet(seg, pelvis0, { toeOutDeg: 10, extraHalfWidth: 0.06 });
      const pelvis = fitToBackrest(seg, anthro, pelvis0, axial, BACKREST, feet0);
      return { pelvis, feet: floorFeet(seg, pelvis, { toeOutDeg: 10, extraHalfWidth: 0.06 }) };
    };
    const ref0 = place(ax0);
    const body0 = solveBody({ seg, anthro, pelvisRef: ref0.pelvis, pelvisPivot: seg.ischium.clone(), axial: ax0, feet: ref0.feet });
    const ref1 = place(ax1);
    const body1 = solveBody({ seg, anthro, pelvisRef: ref1.pelvis, pelvisPivot: seg.ischium.clone(), axial: ax1, feet: ref1.feet });

    // Inicio: la palanca de recorrido se fija (en pasos de 4°) donde el codo alcanza la profundidad objetivo.
    const startFlex = errorId === 'rango_parcial' ? 78 : geom.startFlex;
    const flexAt = (body: typeof body0, theta: number) =>
      elbowFlexFor(seg, body.arms.L.gh.distanceTo(handleAt(geom, 'L', theta)), body.axial.wristExt);
    // Rama ascendente del arco: desde el punto más cercano al hombro hacia arriba.
    let thetaNear = -0.9;
    for (let t = -0.9, best = Infinity; t <= 1.3; t += 0.01) {
      const d = body0.arms.L.gh.distanceTo(handleAt(geom, 'L', t));
      if (d < best) {
        best = d;
        thetaNear = t;
      }
    }
    const thetaStartRaw = bisect(thetaNear, 1.3, (t) => flexAt(body0, t) <= startFlex);
    const startPos = Math.max(1, Math.round((thetaStartRaw + 0.9) / START_STEP) + 1);
    const theta0 = errorId === 'rango_parcial' ? thetaStartRaw : -0.9 + (startPos - 1) * START_STEP;
    const theta1 = bisect(theta0, 1.4, (t) => flexAt(body1, t) <= TOP_FLEX);
    const theta = lerp(theta0, theta1, p);

    const ref = place(axP);
    const pre = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: seg.ischium.clone(), axial: axP, feet: ref.feet });
    const hands = {} as Record<Side, HandTarget>;
    const handles = {} as Record<Side, Vector3>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const grip = handleAt(geom, side, theta);
      let pole = pre.thorax.dir(
        s * lerp(geom.pole0[0], geom.pole1[0], p),
        lerp(geom.pole0[1], geom.pole1[1], p),
        lerp(geom.pole0[2], geom.pole1[2], p),
      );
      if (errorId === 'codos_atras') pole = pre.thorax.dir(s * 0.6, lerp(-0.4, -0.1, p), -1.05);
      const palm = geom.kind === 'prono' ? pre.thorax.dir(0, 0.15, 1) : pre.thorax.dir(-s, 0, 0.15);
      hands[side] = { grip, pole: pole.normalize(), palm: palm.normalize() };
      handles[side] = grip;
    }
    const body = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: seg.ischium.clone(), axial: axP, feet: ref.feet, hands });

    const load = describeLoad(MILITAR_LOAD, input.loadKg);
    const tangent = arcTangent(theta);
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: handles[side].clone(),
      force: tangent.clone().multiplyScalar(-load.forceN / 2),
    }));
    const stackLift = Math.max(0, (theta - theta0) * RADIUS * 0.55);
    const gripText =
      geom.kind === 'prono'
        ? `Manerales horizontales, palmas al frente (${Math.round(geom.halfX * 200)} cm entre manos)`
        : `Manerales verticales, palmas enfrentadas (${Math.round(geom.halfX * 200)} cm entre manos)`;

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
        stackLift,
        stackPlates: 18,
        selectedPlates: Math.round(input.loadKg / 5),
        recline: MILITAR_RECLINE,
      },
      forces,
      setup: [
        { label: 'Asiento', value: `Posición ${seat.pos} (${Math.round(seat.value * 100)} cm)`, note: 'Los manerales, al inicio, a la altura de la barbilla' },
        { label: 'Palanca de inicio', value: `Posición ${startPos}`, note: 'Al empezar, los codos quedan por debajo de las manos' },
        { label: 'Respaldo', value: `${MILITAR_RECLINE}° hacia atrás`, note: 'Zona lumbar y espalda alta apoyadas' },
        { label: 'Agarre', value: gripText },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
