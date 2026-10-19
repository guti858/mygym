import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side } from '../../engine/body';
import type { Segments } from '../../engine/anthropometry';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { DEG, Frame, clamp, lerp, qAxis, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import { axialAt, reachFor, type AxialKeys, type Keys } from '../common';

/**
 * Fondos en paralelas (peso corporal). Las manos quedan fijas en los agarres y es el cuerpo el
 * que se mueve («IK invertida»): para cada instante se decide dónde debe estar el hombro respecto
 * a la mano (flexión de codo y ángulo del brazo) y se traslada todo el cuerpo hasta allí.
 * Carga: peso corporal − asistencia (rodillera con contrapeso) o + lastre (cinturón).
 */

export interface FondosMachine {
  barY: number;
  /** Agarres sobre las paralelas (su z depende de la anchura de la modalidad). */
  grips: Record<Side, Vector3>;
  /** Asistencia (kg, rodillera) o lastre (kg, cinturón). */
  assistKg: number;
  ballastKg: number;
  kneePad: Vector3 | null;
  belt: Vector3 | null;
  stackLift: number;
}

interface VariantGeom {
  halfWidth: number;
  /** Ángulo del brazo sobre la horizontal en el punto más bajo (+ hombro por encima del codo). */
  bottomArm: number;
  /** Inclinación del tronco (+ adelante) a lo largo del recorrido (p = 0 abajo, 1 arriba). */
  lean: Keys;
  /** Polo del codo (sistema del tórax): hacia atrás, más o menos abierto. */
  pole: readonly [number, number, number];
  thoracicFlex: number;
}

const GEOM: Record<string, VariantGeom> = {
  pectoral: {
    halfWidth: 0.29,
    bottomArm: 4,
    lean: [
      { p: 0, v: 27 },
      { p: 1, v: 22 },
    ],
    pole: [0.55, -0.1, -1],
    thoracicFlex: 6,
  },
  triceps: {
    halfWidth: 0.235,
    bottomArm: 20,
    lean: [
      { p: 0, v: 6 },
      { p: 1, v: 3 },
    ],
    pole: [0.1, -0.05, -1],
    thoracicFlex: 0,
  },
};

export const FONDOS_BAR_Y = 1.2;
const TOP_FLEX = 12;

/** Paralela derecha en planta (x, z): ancha junto a la torre y estrecha delante. */
export const FONDOS_BAR_PATH: ReadonlyArray<readonly [number, number]> = [
  [0.36, -0.22],
  [0.31, -0.02],
  [0.22, 0.3],
];

/** Media separación de la paralela a una profundidad z. */
export function barHalfWidthAt(z: number): number {
  for (let i = 1; i < FONDOS_BAR_PATH.length; i++) {
    const [x0, z0] = FONDOS_BAR_PATH[i - 1]!;
    const [x1, z1] = FONDOS_BAR_PATH[i]!;
    if (z <= z1 || i === FONDOS_BAR_PATH.length - 1) return lerp(x0, x1, clamp((z - z0) / (z1 - z0), 0, 1));
  }
  return FONDOS_BAR_PATH[0]![0];
}

/** Profundidad z donde la paralela tiene la media separación pedida (allí van las manos). */
function gripZFor(halfWidth: number): number {
  for (let i = 1; i < FONDOS_BAR_PATH.length; i++) {
    const [x0, z0] = FONDOS_BAR_PATH[i - 1]!;
    const [x1, z1] = FONDOS_BAR_PATH[i]!;
    if (halfWidth >= x1 || i === FONDOS_BAR_PATH.length - 1) return lerp(z0, z1, clamp((x0 - halfWidth) / (x0 - x1), 0, 1));
  }
  return FONDOS_BAR_PATH[0]![1];
}

export const FONDOS_LOAD: LoadSpec = { kind: 'corporal', maxAssistKg: 50, maxBallastKg: 40, stepKg: 5, label: 'Peso corporal ± asistencia o lastre' };

const AXIAL_KEYS: AxialKeys = {
  scapElev: [
    { p: 0, v: -3 },
    { p: 1, v: -8 },
  ],
  scapProt: [
    { p: 0, v: 6 },
    { p: 1, v: -4 },
  ],
  lumbarFlex: [{ p: 0, v: 0 }],
  neckFlex: [{ p: 0, v: 6 }],
  wristExt: [
    { p: 0, v: 8 },
    { p: 1, v: 4 },
  ],
};

function axialFor(geom: VariantGeom, p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = { thoracicFlex: geom.thoracicFlex };
  if (errorId === 'hombros') {
    over.scapElev = lerp(18, 6, p);
    over.scapProt = lerp(24, 10, p);
  }
  return axialAt(AXIAL_KEYS, p, over);
}

function leanFor(geom: VariantGeom, p: number, errorId: string | null): number {
  if (errorId === 'balanceo') {
    // Impulso con piernas y tronco: el cuerpo se balancea adelante al subir.
    return sampleKeys(
      [
        { p: 0, v: geom.lean[0]!.v + 22 },
        { p: 0.4, v: geom.lean[0]!.v + 34 },
        { p: 1, v: geom.lean[1]!.v + 10 },
      ],
      p,
    );
  }
  return sampleKeys(geom.lean, p);
}

/** Piernas colgando: cadera algo flexionada, rodillas flexionadas con los pies por detrás. */
function hangingFeet(seg: Segments, pelvis: Frame): Record<Side, FootTarget> {
  const out = {} as Record<Side, FootTarget>;
  const hip = 18 * DEG;
  const knee = 80 * DEG;
  const plantar = 35 * DEG;
  const dirAt = (a: number) => pelvis.dir(0, -Math.cos(a), Math.sin(a));
  for (const side of SIDES) {
    const s = sideSign(side);
    const hjc = pelvis.point(s * seg.hipHalfWidth, 0, 0);
    const kneeP = hjc.clone().add(dirAt(hip).multiplyScalar(seg.thigh));
    const ankle = kneeP.clone().add(dirAt(hip - knee).multiplyScalar(seg.shank));
    const footA = hip - knee + Math.PI / 2 - plantar;
    const toeDir = dirAt(footA);
    const up = dirAt(footA - Math.PI / 2).negate();
    out[side] = {
      heel: ankle.clone().sub(up.clone().multiplyScalar(seg.ankleHeight)).sub(toeDir.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir,
      up,
      kneePole: pelvis.dir(s * 0.1, 0, 1),
      heelLiftAllowed: false,
    };
  }
  return out;
}

export const fondosLogic: StationLogic<FondosMachine> = {
  id: 'fondos',
  forward: new Vector3(0, 0, 1),
  startAt: 'contraccion',
  load: FONDOS_LOAD,
  defaultLoadKg: 0,
  bounds: { min: [-0.7, 0, -0.75], max: [0.7, 2.3, 0.75] },
  framePoints: (m) => [
    new Vector3(0.6, 0, -0.7),
    new Vector3(-0.6, 0, -0.7),
    new Vector3(0.6, 0, 0.6),
    new Vector3(-0.6, 0, 0.6),
    new Vector3(0.6, m.barY + 1.0, -0.5),
    new Vector3(-0.6, m.barY + 1.0, -0.5),
  ],
  solve(input: StationFrameInput): StationSolution<FondosMachine> {
    const { seg, anthro, p, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM.pectoral!;
    const axial = axialFor(geom, p, errorId);
    const lean = leanFor(geom, p, errorId);

    const gripZ = gripZFor(geom.halfWidth);
    const grips = {} as Record<Side, Vector3>;
    for (const side of SIDES) grips[side] = new Vector3(sideSign(side) * geom.halfWidth, FONDOS_BAR_Y + 0.02, gripZ);

    // Dónde debe quedar el hombro respecto a la mano: abajo, antebrazo vertical y hombro a la
    // altura del codo; arriba, brazo casi vertical con el codo casi extendido.
    const deep = errorId === 'profundidad';
    const bottomArm = deep ? -24 : geom.bottomArm;
    const bottomFlex = 90 - bottomArm;
    const topFlex = errorId === 'bloqueo' ? 0.5 : TOP_FLEX;
    const flex = lerp(bottomFlex, topFlex, p);
    const reach = reachFor(seg, flex, axial.wristExt);
    // Ángulo de la línea mano → hombro respecto a la vertical (hacia delante).
    const fa = seg.forearm + 0.9 * seg.hand;
    const bottomTilt = Math.atan2(seg.upperArm * Math.cos(bottomArm * DEG), fa + seg.upperArm * Math.sin(bottomArm * DEG));
    const topTilt = (geom.lean[1]!.v * 0.35 + 3) * DEG;
    const tilt = lerp(bottomTilt, topTilt, Math.pow(p, 0.8));

    const q = qAxis(new Vector3(1, 0, 0), lean - axial.lumbarFlex - axial.thoracicFlex);
    const probe = new Frame(new Vector3(), q);
    const pre = solveBody({ seg, anthro, pelvisRef: probe, pelvisPivot: new Vector3(), axial, feet: hangingFeet(seg, probe) });
    const ghHalf = (Math.abs(pre.arms.L.gh.x) + Math.abs(pre.arms.R.gh.x)) / 2;
    const dx = ghHalf - geom.halfWidth;
    const ryz = Math.sqrt(Math.max(0.01, reach * reach - dx * dx));
    const target = new Vector3(0, FONDOS_BAR_Y + 0.02 + Math.cos(tilt) * ryz, gripZ + Math.sin(tilt) * ryz);
    const ghMid = pre.arms.L.gh.clone().add(pre.arms.R.gh).multiplyScalar(0.5);
    const pelvis = new Frame(target.clone().sub(ghMid).setX(0), q);
    const feet = hangingFeet(seg, pelvis);

    const hands = {} as Record<Side, HandTarget>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const pole = errorId === 'codos_abiertos' ? pre.thorax.dir(s * 1.5, 0.05, -0.5) : pre.thorax.dir(s * geom.pole[0], geom.pole[1], geom.pole[2]);
      hands[side] = { grip: grips[side].clone(), pole: pole.normalize(), palm: new Vector3(-s, -0.35, 0.1).normalize() };
    }
    const body = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet, hands });

    const load = describeLoad(FONDOS_LOAD, input.loadKg, anthro.massKg);
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: grips[side].clone(),
      force: new Vector3(0, load.forceN / 2, 0),
    }));
    const assistKg = Math.max(0, -input.loadKg);
    const ballastKg = Math.max(0, input.loadKg);
    const kneeL = body.legs.L.knee;
    const kneeR = body.legs.R.knee;
    const kneeMid = kneeL.clone().add(kneeR).multiplyScalar(0.5);
    return {
      body,
      machine: {
        barY: FONDOS_BAR_Y,
        grips,
        assistKg,
        ballastKg,
        kneePad: assistKg > 0 ? kneeMid.clone().add(new Vector3(0, -seg.r.shank - 0.04, -0.02)) : null,
        belt: ballastKg > 0 ? body.pelvis.point(0, -0.02 * seg.H, -0.02 * seg.H) : null,
        stackLift: assistKg > 0 ? Math.max(0, 0.45 - (body.pelvis.origin.y - 0.7)) * 0.4 : 0,
      },
      forces,
      setup: [
        {
          label: 'Paralelas',
          value: input.variantId === 'triceps' ? `Zona estrecha (${Math.round(geom.halfWidth * 200)} cm)` : `Zona ancha (${Math.round(geom.halfWidth * 200)} cm)`,
          note: 'Agarre neutro, muñecas alineadas con el antebrazo',
        },
        {
          label: 'Modo',
          value: assistKg > 0 ? `Asistida: −${assistKg} kg en la rodillera` : ballastKg > 0 ? `Lastrada: +${ballastKg} kg en el cinturón` : 'Libre (peso corporal)',
          note: 'Elige la carga que te permita 6–12 repeticiones con la profundidad correcta',
        },
        { label: 'Profundidad', value: 'Hasta que el hombro quede a la altura del codo', note: 'Brazo aproximadamente paralelo al suelo' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
