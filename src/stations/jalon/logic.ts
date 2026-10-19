import { Vector3 } from 'three';
import { NEUTRAL_AXIAL, SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side } from '../../engine/body';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { Frame, clamp, lerp, qAxis, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { Segments } from '../../engine/anthropometry';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';

type Keys = ReadonlyArray<{ p: number; v: number }>;

export type BarKind = 'larga' | 'recta' | 'v';

export interface JalonMachine {
  seatY: number;
  seatPos: number;
  padY: number;
  padZ: number;
  padPos: number;
  pulleyFront: Vector3;
  pulleyBack: Vector3;
  bar: Vector3;
  barKind: BarKind;
  hands: Record<Side, Vector3>;
  stackLift: number;
  stackPlates: number;
  selectedPlates: number;
}

interface VariantGeom {
  barKind: BarKind;
  /** Media distancia entre manos, en fracciones de la talla. */
  halfGripH: number;
  /** Altura del punto de contacto en el pecho, bajo C7 (fracción de talla). */
  chestDropH: number;
  lean: Keys;
  palm: 'prono' | 'supino' | 'neutro';
  poleTop: readonly [number, number, number];
  poleBottom: readonly [number, number, number];
}

const AXIAL_KEYS = {
  scapElev: [
    { p: 0, v: 14 },
    { p: 0.18, v: -4 },
    { p: 1, v: -8 },
  ],
  scapProt: [
    { p: 0, v: 6 },
    { p: 0.3, v: 0 },
    { p: 1, v: -14 },
  ],
  lumbarFlex: [
    { p: 0, v: 0 },
    { p: 1, v: -4 },
  ],
  thoracicFlex: [
    { p: 0, v: 0 },
    { p: 1, v: -6 },
  ],
  neckFlex: [
    { p: 0, v: 2 },
    { p: 1, v: 4 },
  ],
} satisfies Partial<Record<keyof AxialParams, Keys>>;

const GEOM: Record<string, VariantGeom> = {
  'prono-ancho': {
    barKind: 'larga',
    halfGripH: 0.195,
    chestDropH: 0.08,
    lean: [
      { p: 0, v: 6 },
      { p: 1, v: 14 },
    ],
    palm: 'prono',
    poleTop: [1, -0.15, -0.3],
    poleBottom: [0.8, -0.6, -0.35],
  },
  'supino-estrecho': {
    barKind: 'recta',
    halfGripH: 0.115,
    chestDropH: 0.085,
    lean: [
      { p: 0, v: 6 },
      { p: 1, v: 12 },
    ],
    palm: 'supino',
    poleTop: [0.3, -0.2, 1],
    poleBottom: [0.3, -0.7, 0.6],
  },
  'neutro-v': {
    barKind: 'v',
    halfGripH: 0.043,
    chestDropH: 0.1,
    lean: [
      { p: 0, v: 8 },
      { p: 1, v: 16 },
    ],
    palm: 'neutro',
    poleTop: [0.5, -0.2, 0.6],
    poleBottom: [0.45, -0.7, 0.45],
  },
};

const PULLEY_FRONT = new Vector3(0, 2.3, 0.14);
const PULLEY_BACK = new Vector3(0, 2.3, 0.88);
const SEAT_MIN = 0.36;
const SEAT_STEP = 0.025;
const SEAT_POSITIONS = 9;
const PAD_STEP = 0.025;
const PAD_RADIUS = 0.05;
const ISCHIUM_CONTACT_Z = -0.02;
const ELBOW_TOP_FLEX = 12;

export const JALON_LOAD: LoadSpec = { kind: 'pila', minKg: 5, maxKg: 100, stepKg: 5, ratio: 1, label: 'Pila de placas' };

function axialAt(p: number, errorId: string | null): AxialParams {
  const a: AxialParams = { ...NEUTRAL_AXIAL };
  a.scapElev = sampleKeys(AXIAL_KEYS.scapElev, p);
  a.scapProt = sampleKeys(AXIAL_KEYS.scapProt, p);
  a.lumbarFlex = sampleKeys(AXIAL_KEYS.lumbarFlex, p);
  a.thoracicFlex = sampleKeys(AXIAL_KEYS.thoracicFlex, p);
  a.neckFlex = sampleKeys(AXIAL_KEYS.neckFlex, p);
  if (errorId === 'encogimiento') {
    a.scapElev = 16;
    a.scapProt = 4;
  } else if (errorId === 'balanceo') {
    a.lumbarFlex = lerp(0, -10, p);
  } else if (errorId === 'tras_nuca') {
    a.neckFlex = lerp(10, 32, p);
    a.thoracicFlex = lerp(0, 4, p);
  }
  return a;
}

function leanAt(geom: VariantGeom, p: number, errorId: string | null): number {
  if (errorId === 'balanceo') {
    return sampleKeys(
      [
        { p: 0, v: 5 },
        { p: 0.5, v: 26 },
        { p: 1, v: 34 },
      ],
      p,
    );
  }
  if (errorId === 'tras_nuca') return lerp(2, -3, p);
  return sampleKeys(geom.lean, p);
}

/** Asiento: muslos horizontales con la tibia vertical y los pies planos. */
export function seatSetup(seg: Segments) {
  const kneeY = seg.ankleHeight + seg.shank + 0.02;
  const target = kneeY + 0.01 - Math.abs(seg.ischium.y);
  const pos = clamp(Math.round((target - SEAT_MIN) / SEAT_STEP) + 1, 1, SEAT_POSITIONS);
  return { pos, y: SEAT_MIN + SEAT_STEP * (pos - 1) };
}

function pelvisFrame(seg: Segments, seatY: number, leanDeg: number): Frame {
  const q = qAxis(new Vector3(1, 0, 0), -leanDeg);
  const contact = new Vector3(0, seatY, ISCHIUM_CONTACT_Z);
  const origin = contact.clone().sub(seg.ischium.clone().applyQuaternion(q));
  return new Frame(origin, q);
}

function footTargets(seg: Segments, pelvis0: Frame): Record<Side, FootTarget> {
  const out = {} as Record<Side, FootTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const hjc = pelvis0.point(s * seg.hipHalfWidth, 0, 0);
    const toeOut = 8;
    const toeDir = new Vector3(s * Math.sin((toeOut * Math.PI) / 180), 0, Math.cos((toeOut * Math.PI) / 180));
    const ankleZ = hjc.z + 0.92 * seg.thigh;
    out[side] = {
      heel: new Vector3(s * (seg.hipHalfWidth + 0.035), 0, ankleZ - seg.heelToAnkle),
      toeDir,
      up: new Vector3(0, 1, 0),
      heelLiftAllowed: false,
    };
  }
  return out;
}

export const jalonLogic: StationLogic<JalonMachine> = {
  id: 'jalon',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: JALON_LOAD,
  defaultLoadKg: 40,
  bounds: { min: [-0.65, 0, -0.5], max: [0.65, 2.42, 1.05] },
  framePoints: (m) => [
    m.pulleyFront.clone().add(new Vector3(0, 0.1, 0)),
    new Vector3(0.25, 2.42, 0.98),
    new Vector3(-0.25, 2.42, 0.98),
    new Vector3(0.25, 0, 0.98),
    new Vector3(-0.25, 0, 0.98),
    new Vector3(0.3, 0, -0.25),
    new Vector3(-0.3, 0, -0.25),
    new Vector3(0.3, m.padY, m.padZ),
    new Vector3(-0.3, m.padY, m.padZ),
    m.bar.clone().add(new Vector3(0.62, 0, 0)),
    m.bar.clone().add(new Vector3(-0.62, 0, 0)),
  ],
  solve(input: StationFrameInput): StationSolution<JalonMachine> {
    const { seg, anthro, p, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM['prono-ancho']!;
    const seat = seatSetup(seg);

    const pelvis0 = pelvisFrame(seg, seat.y, leanAt(geom, 0, errorId));
    const feet = footTargets(seg, pelvis0);
    const pivot = seg.ischium.clone();

    // Posturas extremas para construir la trayectoria de la barra.
    const top = solveBody({ seg, anthro, pelvisRef: pelvis0, pelvisPivot: pivot, axial: axialAt(0, errorId), feet });
    const pelvis1 = pelvisFrame(seg, seat.y, leanAt(geom, 1, errorId));
    const bottom = solveBody({ seg, anthro, pelvisRef: pelvis1, pelvisPivot: pivot, axial: axialAt(1, errorId), feet });

    const halfGrip = geom.halfGripH * seg.H;
    const b = seg.forearm + seg.hand;
    const a = seg.upperArm;
    const reach = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos((ELBOW_TOP_FLEX * Math.PI) / 180));
    const gh0 = top.arms.L.gh;
    const behindNeck = errorId === 'tras_nuca';
    const topZ = behindNeck ? gh0.z - 0.06 : gh0.z + 0.06;
    const dx = Math.abs(halfGrip - Math.abs(gh0.x));
    const dz = topZ - gh0.z;
    const dy = Math.sqrt(Math.max(0.05, reach * reach - dx * dx - dz * dz));
    const barTop = new Vector3(0, gh0.y + dy, topZ);

    const th1 = bottom.thorax;
    let barBottom: Vector3;
    if (behindNeck) {
      barBottom = th1.point(0, seg.thoracic + 0.012 * seg.H, -(seg.r.thoraxBack + 0.035));
      barBottom.x = 0;
    } else {
      barBottom = th1.point(0, seg.thoracic - geom.chestDropH * seg.H, seg.r.thoraxFront + 0.035);
      barBottom.x = 0;
    }
    if (errorId === 'rango_incompleto') barBottom = barTop.clone().lerp(barBottom, 0.5);

    const bar = barTop.clone().lerp(barBottom, p);
    if (!behindNeck) bar.z += 0.035 * Math.sin(Math.PI * p);

    const lean = leanAt(geom, p, errorId);
    const pelvisRef = pelvisFrame(seg, seat.y, lean);
    const axial = axialAt(p, errorId);
    // Tórax provisional para orientar los polos de los codos.
    const pre = solveBody({ seg, anthro, pelvisRef, pelvisPivot: pivot, axial, feet });
    const hands = {} as Record<Side, HandTarget>;
    const handPos = {} as Record<Side, Vector3>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const grip = bar.clone().add(new Vector3(s * halfGrip, 0, 0));
      const pt = geom.poleTop;
      const pb = geom.poleBottom;
      const pole = pre.thorax.dir(s * lerp(pt[0], pb[0], p), lerp(pt[1], pb[1], p), lerp(pt[2], pb[2], p));
      if (behindNeck) pole.copy(pre.thorax.dir(s, -0.35, -0.45));
      const palm =
        geom.palm === 'prono'
          ? pre.thorax.dir(0, 0, 1)
          : geom.palm === 'supino'
            ? pre.thorax.dir(0, 0, -1)
            : pre.thorax.dir(-s, 0, 0);
      hands[side] = { grip, pole: pole.normalize(), palm };
      handPos[side] = grip;
    }
    const body = solveBody({ seg, anthro, pelvisRef, pelvisPivot: pivot, axial, feet, hands });

    // Rodillo de muslos: sobre el 80 % distal del muslo, en la postura inicial.
    const thighPt = top.legs.L.hjc.clone().lerp(top.legs.L.knee, 0.8);
    const padRaw = thighPt.y + seg.r.thigh + PAD_RADIUS;
    const padPos = Math.max(1, Math.ceil((padRaw - seat.y - 0.08) / PAD_STEP));
    const padY = seat.y + 0.08 + padPos * PAD_STEP;

    const load = describeLoad(JALON_LOAD, input.loadKg);
    const dir = PULLEY_FRONT.clone().sub(bar).normalize();
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: handPos[side].clone(),
      force: dir.clone().multiplyScalar(load.forceN / 2),
    }));
    const stackLift = Math.max(0, bar.distanceTo(PULLEY_FRONT) - barTop.distanceTo(PULLEY_FRONT));

    const gripCm = Math.round(2 * halfGrip * 100);
    const gripText =
      geom.palm === 'prono'
        ? `Prono, ${gripCm} cm entre manos (≈1,5× anchura de hombros)`
        : geom.palm === 'supino'
          ? `Supino, ${gripCm} cm entre manos (anchura de hombros)`
          : `Neutro con maneral en V (${gripCm} cm)`;

    return {
      body,
      machine: {
        seatY: seat.y,
        seatPos: seat.pos,
        padY,
        padZ: thighPt.z,
        padPos,
        pulleyFront: PULLEY_FRONT.clone(),
        pulleyBack: PULLEY_BACK.clone(),
        bar,
        barKind: geom.barKind,
        hands: handPos,
        stackLift,
        stackPlates: JALON_LOAD.kind === 'pila' ? JALON_LOAD.maxKg / JALON_LOAD.stepKg : 20,
        selectedPlates: Math.round(input.loadKg / 5),
      },
      forces,
      setup: [
        { label: 'Asiento', value: `Posición ${seat.pos} (${Math.round(seat.y * 100)} cm)`, note: 'Muslos paralelos al suelo y pies planos' },
        { label: 'Rodillo de muslos', value: `Posición ${padPos}`, note: 'Bloquea los muslos sin presionarlos' },
        { label: 'Agarre', value: gripText },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
