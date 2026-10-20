import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side, type SolvedBody } from '../../engine/body';
import type { Anthropometry, Segments } from '../../engine/anthropometry';
import { describeLoad, G, type LoadSpec } from '../../engine/load';
import { DEG, Frame, lerp, qAxis, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { SetupLine, StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import {
  armFromHumerus,
  axialAt,
  backrestPlane,
  chestPoint,
  fitToBackrest,
  floorFeet,
  reachFor,
  seatedPelvis,
  standingPose,
  type AxialKeys,
} from '../common';

/**
 * Rack de mancuernas: estación variable con siete ejercicios de peso libre. Cada ejercicio define la
 * postura y la trayectoria de las manos; la fuerza externa es el peso de las mancuernas en las manos.
 * Banco regulable (vertical, inclinado a 30° o plano) cuando el ejercicio lo usa.
 */

export type Ejercicio = 'curl' | 'press-hombro' | 'elevaciones' | 'remo' | 'press-inclinado' | 'peso-muerto' | 'goblet';

export interface Dumbbell {
  center: Vector3;
  /** Eje del mango. */
  axis: Vector3;
}

/** Plano del respaldo: reclinado `recline` grados desde la vertical y pasando por (0, y, z). */
export interface BenchBack {
  recline: number;
  y: number;
  z: number;
}

export interface BenchPose {
  /** Respaldo (banco regulable) o ninguno (banco plano). */
  back: BenchBack | null;
  /** Centro del asiento o del banco (x, z) y altura de su superficie. */
  x: number;
  z: number;
  top: number;
  /** Largo del banco plano (remo) o del asiento. */
  length: number;
}

/** Respaldos del banco regulable: vertical para el press de hombro, a 30° sobre la horizontal para el inclinado. */
export const BENCH_BACKS: Record<'vertical' | 'inclinado', BenchBack> = {
  vertical: { recline: 5, y: 0.95, z: -0.16 },
  inclinado: { recline: 60, y: 0.62, z: -0.18 },
};

export interface MancuernasMachine {
  exercise: Ejercicio;
  dumbbells: Dumbbell[];
  kg: number;
  bench: BenchPose | null;
}

export const MANCUERNAS_LOAD: LoadSpec = { kind: 'mancuernas', minKg: 2, maxKg: 50, stepKg: 2, label: 'Mancuernas (kg por mancuerna)' };

/** Ejercicios que empiezan de pie (en contracción): primero la fase excéntrica. */
const FROM_TOP: ReadonlySet<string> = new Set(['peso-muerto', 'goblet']);

export const BENCH_TOP = 0.45;
const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);

const BASE: AxialKeys = {
  scapElev: [{ p: 0, v: -3 }],
  scapProt: [{ p: 0, v: -4 }],
  lumbarFlex: [{ p: 0, v: -4 }],
  thoracicFlex: [{ p: 0, v: 0 }],
  neckFlex: [{ p: 0, v: 3 }],
  wristExt: [{ p: 0, v: 2 }],
};

interface Pose {
  body: SolvedBody;
  dumbbells: Dumbbell[];
  /** Manos que sostienen peso y fracción del peso de una mancuerna en cada una. */
  loaded: Array<{ side: Side; share: number }>;
  bench: BenchPose | null;
  setup: SetupLine[];
}

type Ctx = { seg: Segments; anthro: Anthropometry; p: number; errorId: string | null };

/** Mancuerna en la mano: el mango, perpendicular al antebrazo y a la palma. */
function dumbbellAt(body: SolvedBody, side: Side): Dumbbell {
  const arm = body.arms[side];
  const fore = arm.grip.clone().sub(arm.wrist).normalize();
  let axis = fore.clone().cross(arm.palm);
  if (axis.lengthSq() < 1e-6) axis = X.clone();
  return { center: arm.grip.clone(), axis: axis.normalize() };
}

/** Polo que deja el codo en `elbow` para un brazo hombro → agarre. */
function poleFor(gh: Vector3, grip: Vector3, elbow: Vector3, fallback: Vector3): Vector3 {
  const d = grip.clone().sub(gh).normalize();
  const pole = elbow.clone().sub(gh.clone().add(d.multiplyScalar(elbow.clone().sub(gh).dot(d))));
  return pole.lengthSq() > 1e-8 ? pole.normalize() : fallback.clone().normalize();
}

/** Longitud antebrazo + mano hasta el centro del agarre (como en la IK). */
function forearmLink(seg: Segments, wristExt: number) {
  const w = wristExt * DEG;
  return Math.sqrt(seg.forearm ** 2 + seg.hand ** 2 + 2 * seg.forearm * seg.hand * Math.cos(w));
}

const solveWith = (ctx: Ctx, pelvis: Frame, axial: AxialParams, feet: Record<Side, FootTarget>, hands?: Record<Side, HandTarget>, pivot = new Vector3()) =>
  solveBody({ seg: ctx.seg, anthro: ctx.anthro, pelvisRef: pelvis, pelvisPivot: pivot, axial, feet, hands });

// ---------------------------------------------------------------------------------------------
// De pie, solo se mueve el codo: curl
// ---------------------------------------------------------------------------------------------
function curl(ctx: Ctx): Pose {
  const { p, errorId } = ctx;
  const axial = axialAt(BASE, p, {
    ...(errorId === 'munecas' ? { wristExt: lerp(-8, -38, p) } : {}),
    ...(errorId === 'balanceo' ? { lumbarFlex: lerp(-4, -14, p) } : {}),
  });
  const lean = errorId === 'balanceo' ? sampleKeys([{ p: 0, v: 4 }, { p: 0.5, v: -8 }, { p: 1, v: -20 }], p) : 2;
  const place = standingPose(ctx.seg, axial, lean, 6);
  const pre = solveWith(ctx, place.pelvis, axial, place.feet);
  const flex = errorId === 'codos' ? lerp(6, 42, p) : 6;
  const hands = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const t = armFromHumerus(pre, ctx.seg, side, flex, 9, lerp(10, 136, p), axial.wristExt);
    hands[side] = { grip: t.grip, pole: t.pole, palm: t.foreAnt };
  }
  const body = solveWith(ctx, place.pelvis, axial, place.feet, hands);
  return {
    body,
    dumbbells: SIDES.map((s) => dumbbellAt(body, s)),
    loaded: SIDES.map((side) => ({ side, share: 1 })),
    bench: null,
    setup: [{ label: 'Postura', value: 'De pie, pies a la anchura de las caderas', note: 'Codos pegados a los costados; palmas hacia delante' }],
  };
}

// ---------------------------------------------------------------------------------------------
// Press con el antebrazo vertical (hombro sentado e inclinado)
// ---------------------------------------------------------------------------------------------
/** Codo a partir de una dirección del húmero (sistema del tórax) y mano encima, con el antebrazo vertical. */
function pressHand(body: SolvedBody, seg: Segments, side: Side, uThorax: Vector3, wristExt: number) {
  const arm = body.arms[side];
  const u = body.thorax.dir(uThorax.x, uThorax.y, uThorax.z).normalize();
  const elbow = arm.gh.clone().add(u.multiplyScalar(seg.upperArm));
  const grip = elbow.clone().add(UP.clone().multiplyScalar(forearmLink(seg, wristExt)));
  return { elbow, grip };
}

function pressHombro(ctx: Ctx): Pose {
  const { seg, p, errorId } = ctx;
  const axial = axialAt(BASE, p, {
    scapElev: lerp(-2, 8, p),
    ...(errorId === 'arco_lumbar' ? { lumbarFlex: lerp(-18, -26, p), pelvisTilt: 8 } : {}),
  });
  const back = backrestPlane(BENCH_BACKS.vertical.recline, BENCH_BACKS.vertical.y, BENCH_BACKS.vertical.z);
  const pelvis0 = seatedPelvis(seg, BENCH_TOP + 0.02, 5, 0.02);
  const feet0 = floorFeet(seg, pelvis0, { toeOutDeg: 12, extraHalfWidth: 0.1 });
  const pelvis = fitToBackrest(seg, ctx.anthro, pelvis0, axialAt(BASE, 0), back, feet0);
  const feet = floorFeet(seg, pelvis, { toeOutDeg: 12, extraHalfWidth: 0.1 });
  const pre = solveWith(ctx, pelvis, axial, feet, undefined, seg.ischium.clone());
  // Húmero en el plano de la escápula (30° por delante del frontal): de 80° a 165° de elevación.
  const plane = (errorId === 'codos_atras' ? -18 : 30) * DEG;
  const th0 = errorId === 'recorrido_parcial' ? 118 : 80;
  const theta = lerp(th0, 165, p) * DEG;
  const hands = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const uT = new Vector3(s * Math.sin(theta) * Math.cos(plane), -Math.cos(theta), Math.sin(theta) * Math.sin(plane));
    const { elbow, grip } = pressHand(pre, seg, side, uT, axial.wristExt);
    hands[side] = { grip, pole: poleFor(pre.arms[side].gh, grip, elbow, pre.thorax.dir(s, -0.3, 0)), palm: pre.thorax.dir(0, 0, 1) };
  }
  const body = solveWith(ctx, pelvis, axial, feet, hands, seg.ischium.clone());
  return {
    body,
    dumbbells: SIDES.map((s) => dumbbellAt(body, s)),
    loaded: SIDES.map((side) => ({ side, share: 1 })),
    bench: { back: BENCH_BACKS.vertical, x: 0, z: 0.1, top: BENCH_TOP, length: 0.4 },
    setup: [{ label: 'Banco', value: 'Respaldo vertical (85°)', note: 'Espalda y zona lumbar apoyadas; pies firmes en el suelo' }],
  };
}

function pressInclinado(ctx: Ctx): Pose {
  const { seg, p, errorId } = ctx;
  const axial = axialAt(BASE, p, {
    scapProt: errorId === 'hombros_adelantados' ? lerp(-10, 22, p) : lerp(-16, -8, p),
    scapElev: -5,
    lumbarFlex: -8,
    thoracicFlex: -4,
    ...(errorId === 'munecas' ? { wristExt: 42 } : { wristExt: lerp(10, 6, p) }),
  });
  // Banco a 30° sobre la horizontal: el tronco queda reclinado 60° desde la vertical.
  const back = backrestPlane(BENCH_BACKS.inclinado.recline, BENCH_BACKS.inclinado.y, BENCH_BACKS.inclinado.z);
  const pelvis0 = seatedPelvis(seg, BENCH_TOP + 0.02, 60, 0.02);
  const feet0 = floorFeet(seg, pelvis0, { toeOutDeg: 12, extraHalfWidth: 0.12 });
  const pelvis = fitToBackrest(seg, ctx.anthro, pelvis0, axialAt(BASE, 0, { lumbarFlex: -8, thoracicFlex: -4 }), back, feet0);
  const feet = floorFeet(seg, pelvis, { toeOutDeg: 12, extraHalfWidth: 0.12 });
  const pre = solveWith(ctx, pelvis, axial, feet, undefined, seg.ischium.clone());
  const reachTop = reachFor(seg, 12, axial.wristExt);
  const hands = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    // Abajo: codo abierto unos 60° del tronco y algo por detrás de su plano, antebrazo vertical.
    // Arriba: sobre el hombro.
    const u0 = errorId === 'codos_90' ? new Vector3(s, -0.08, -0.25) : new Vector3(s * 0.86, -0.5, -0.05);
    const bottom = pressHand(pre, seg, side, u0, axial.wristExt);
    const top = pre.arms[side].gh.clone().add(new Vector3(-s * 0.04, reachTop, 0));
    const e = 1 - Math.pow(1 - p, 1.6);
    const grip = bottom.grip.clone().lerp(top, e);
    const elbowDir = bottom.elbow.clone().sub(pre.arms[side].gh).normalize();
    const pole = elbowDir.clone().lerp(new Vector3(s, 0, 0), p).normalize();
    hands[side] = { grip, pole, palm: pre.thorax.dir(0, -1, 0.3).normalize() };
  }
  const body = solveWith(ctx, pelvis, axial, feet, hands, seg.ischium.clone());
  return {
    body,
    dumbbells: SIDES.map((s) => dumbbellAt(body, s)),
    loaded: SIDES.map((side) => ({ side, share: 1 })),
    bench: { back: BENCH_BACKS.inclinado, x: 0, z: 0.1, top: BENCH_TOP, length: 0.4 },
    setup: [{ label: 'Banco', value: 'Respaldo inclinado a 30°', note: 'Escápulas juntas y abajo; pies firmes en el suelo' }],
  };
}

// ---------------------------------------------------------------------------------------------
// Elevaciones laterales
// ---------------------------------------------------------------------------------------------
function elevaciones(ctx: Ctx): Pose {
  const { seg, p, errorId } = ctx;
  const high = errorId === 'encogimiento';
  const axial = axialAt(BASE, p, {
    scapElev: high ? lerp(2, 18, p) : lerp(-4, 2, p),
    ...(errorId === 'balanceo' ? { lumbarFlex: lerp(-4, -12, p) } : {}),
  });
  const lean = errorId === 'balanceo' ? sampleKeys([{ p: 0, v: 8 }, { p: 0.4, v: -6 }, { p: 1, v: -16 }], p) : 3;
  const place = standingPose(seg, axial, lean, 6);
  const pre = solveWith(ctx, place.pelvis, axial, place.feet);
  const theta = lerp(12, high ? 114 : 86, p) * DEG;
  const plane = 20 * DEG;
  const elbowFlex = (errorId === 'codos_bloqueados' ? 0 : 20) * DEG;
  const link = forearmLink(seg, axial.wristExt);
  const hands = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const th = pre.thorax;
    const u = th.dir(s * Math.sin(theta) * Math.cos(plane), -Math.cos(theta), Math.sin(theta) * Math.sin(plane)).normalize();
    const gh = pre.arms[side].gh;
    const elbow = gh.clone().add(u.clone().multiplyScalar(seg.upperArm));
    const fwd = th.dir(0, 0, 1);
    const w = fwd.clone().sub(u.clone().multiplyScalar(fwd.dot(u))).normalize();
    const f = u.clone().multiplyScalar(Math.cos(elbowFlex)).add(w.multiplyScalar(Math.sin(elbowFlex))).normalize();
    const grip = elbow.clone().add(f.clone().multiplyScalar(link));
    // Palmas hacia el muslo abajo y hacia el suelo arriba.
    const k = Math.min(1, Math.max(0, (theta / DEG - 12) / 74));
    const palm = th.dir(-s, 0, 0).multiplyScalar(1 - k).add(new Vector3(0, -1, 0).multiplyScalar(k)).normalize();
    hands[side] = { grip, pole: poleFor(gh, grip, elbow, th.dir(s, 0.2, -0.3)), palm };
  }
  const body = solveWith(ctx, place.pelvis, axial, place.feet, hands);
  return {
    body,
    dumbbells: SIDES.map((s) => dumbbellAt(body, s)),
    loaded: SIDES.map((side) => ({ side, share: 1 })),
    bench: null,
    setup: [{ label: 'Postura', value: 'De pie, rodillas algo flexionadas', note: 'Codos semiflexionados (~20°) y fijos' }],
  };
}

// ---------------------------------------------------------------------------------------------
// Remo unilateral: rodilla y mano izquierdas en el banco plano; rema el brazo derecho
// ---------------------------------------------------------------------------------------------
export const REMO_BENCH = { x: 0.13, zBack: -0.55, zFront: 0.75 };

function remo(ctx: Ctx): Pose {
  const { seg, anthro, p, errorId } = ctx;
  const axialFor = (pp: number) =>
    axialAt(BASE, pp, {
      // Solo se mueve la escápula del brazo que rema; la del apoyo queda fija.
      scapProt: -4,
      scapProtSide: { R: lerp(8, -20, pp) },
      scapElev: errorId === 'encogimiento' ? lerp(14, 22, pp) : -4,
      lumbarFlex: errorId === 'espalda_redondeada' ? 20 : -4,
      thoracicFlex: errorId === 'espalda_redondeada' ? 14 : 0,
      neckFlex: 6,
    });
  const axial = axialFor(p);
  const leanAt = (pp: number) => (errorId === 'tronco_sube' ? lerp(72, 38, pp) : 72);
  const hw = seg.hipHalfWidth;
  // Rodilla izquierda sobre el banco; la cadera, a la altura que deja la pierna derecha apoyada en el
  // suelo con la rodilla algo flexionada (el muslo izquierdo se inclina atrás si hace falta).
  const knee = new Vector3(hw, BENCH_TOP + 0.045, 0);
  const standExtra = 0.17;
  const d15 = Math.sqrt(seg.thigh ** 2 + seg.shank ** 2 + 2 * seg.thigh * seg.shank * Math.cos(15 * DEG));
  const hipY = Math.min(knee.y + seg.thigh, seg.ankleHeight + Math.sqrt(Math.max(0.05, d15 * d15 - standExtra ** 2 - 0.12 ** 2)));
  const beta = Math.acos(Math.min(1, (hipY - knee.y) / seg.thigh));
  const pelvisAt = (pp: number, ax: AxialParams) =>
    new Frame(new Vector3(0, hipY, knee.z - seg.thigh * Math.sin(beta)), qAxis(new Vector3(1, 0, 0), leanAt(pp) - ax.lumbarFlex - ax.thoracicFlex));
  const pelvis = pelvisAt(p, axial);
  const ankleL = knee.clone().add(new Vector3(0, -0.01, -seg.shank));
  const toeL = new Vector3(0, -0.3, -1).normalize();
  const upL = new Vector3(0, 1, -0.3).normalize();
  const ankleR = new Vector3(-(hw + standExtra), seg.ankleHeight, pelvis.origin.z - 0.12);
  const feet: Record<Side, FootTarget> = {
    L: {
      heel: ankleL.clone().sub(upL.clone().multiplyScalar(seg.ankleHeight)).sub(toeL.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir: toeL,
      up: upL,
      kneePole: new Vector3(0, -1, 0.5),
      heelLiftAllowed: false,
    },
    R: {
      heel: ankleR.clone().sub(new Vector3(0, seg.ankleHeight, seg.heelToAnkle)),
      toeDir: new Vector3(-0.15, 0, 1).normalize(),
      up: UP.clone(),
      kneePole: new Vector3(-0.2, 0, 1),
      heelLiftAllowed: false,
    },
  };
  const pre = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet });
  const th = pre.thorax;
  // Mano izquierda apoyada en el banco, fija durante la serie: delante del hombro (en p = 0), a la
  // distancia que deja el brazo casi extendido.
  const axial0 = axialFor(0);
  const ghL = solveBody({ seg, anthro, pelvisRef: pelvisAt(0, axial0), pelvisPivot: new Vector3(), axial: axial0, feet }).arms.L.gh;
  const handY = BENCH_TOP + 0.02;
  const supportX = Math.min(REMO_BENCH.x + 0.12, Math.max(REMO_BENCH.x - 0.1, ghL.x));
  const armReach = reachFor(seg, 12, 20);
  const ahead = Math.sqrt(Math.max(0.0009, armReach ** 2 - (ghL.y - handY) ** 2 - (ghL.x - supportX) ** 2));
  const support = new Vector3(supportX, handY, ghL.z + ahead);
  // Brazo derecho: de colgando (codo casi extendido) a la mano junto a la cintura.
  const ghR = pre.arms.R.gh;
  const bottom = ghR.clone().add(new Vector3(0, -reachFor(seg, 10, axial.wristExt), 0.02));
  const top = ghR.clone().add(th.dir(-0.13, -0.33, 0.17));
  const grip = bottom.clone().lerp(top, p).add(th.dir(-0.02, 0, -0.05).multiplyScalar(Math.sin(Math.PI * p)));
  const hands: Record<Side, HandTarget> = {
    L: { grip: support, pole: th.dir(0.4, 0.2, -1).normalize(), palm: new Vector3(0, -1, 0.15).normalize() },
    R: { grip, pole: th.dir(-0.3, -0.3, -1).normalize(), palm: th.dir(1, 0, 0) },
  };
  const body = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet, hands });
  return {
    body,
    dumbbells: [dumbbellAt(body, 'R')],
    loaded: [{ side: 'R', share: 1 }],
    bench: { back: null, x: REMO_BENCH.x, z: (REMO_BENCH.zBack + REMO_BENCH.zFront) / 2, top: BENCH_TOP, length: REMO_BENCH.zFront - REMO_BENCH.zBack },
    setup: [
      { label: 'Banco', value: 'Plano', note: 'Rodilla y mano izquierdas en el banco; pie derecho en el suelo' },
      { label: 'Brazo que rema', value: 'Derecho', note: 'Cambia de lado al terminar la serie' },
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// De pie, con piernas que se mueven: peso muerto rumano y sentadilla goblet
// ---------------------------------------------------------------------------------------------
/**
 * Pelvis a partir de los tobillos fijos: tibia inclinada `beta` hacia delante (en la dirección del
 * pie) y rodilla flexionada `kappa`. Devuelve el punto medio de las caderas. Con los pies más
 * separados que las caderas, la pierna se acorta en el plano sagital lo que se abre hacia fuera.
 */
function hipsFromLegs(seg: Segments, ankles: Record<Side, Vector3>, toe: Record<Side, Vector3>, betaDeg: number, kappaDeg: number): Vector3 {
  const mid = new Vector3();
  for (const side of SIDES) {
    const t = toe[side].clone().setY(0).normalize();
    const dx = Math.abs(ankles[side].x) - seg.hipHalfWidth;
    const f = Math.sqrt(Math.max(0.5, 1 - (dx / (seg.thigh + seg.shank)) ** 2));
    const b = betaDeg * DEG;
    const knee = ankles[side].clone().add(t.clone().multiplyScalar(Math.sin(b) * seg.shank * f)).add(UP.clone().multiplyScalar(Math.cos(b) * seg.shank * f));
    const a = (kappaDeg - betaDeg) * DEG;
    const hip = knee.add(UP.clone().multiplyScalar(Math.cos(a) * seg.thigh * f)).sub(t.multiplyScalar(Math.sin(a) * seg.thigh * f));
    mid.add(hip.multiplyScalar(0.5));
  }
  return mid;
}

function legStance(seg: Segments, extra: number, toeOutDeg: number) {
  const ankles = {} as Record<Side, Vector3>;
  const toe = {} as Record<Side, Vector3>;
  for (const side of SIDES) {
    const s = sideSign(side);
    ankles[side] = new Vector3(s * (seg.hipHalfWidth + extra), seg.ankleHeight, 0);
    toe[side] = new Vector3(s * Math.sin(toeOutDeg * DEG), 0, Math.cos(toeOutDeg * DEG));
  }
  return { ankles, toe };
}

function stanceFeet(seg: Segments, stance: ReturnType<typeof legStance>, pole?: (side: Side) => Vector3, heelLiftAllowed = true): Record<Side, FootTarget> {
  const out = {} as Record<Side, FootTarget>;
  for (const side of SIDES) {
    const t = stance.toe[side];
    out[side] = {
      heel: stance.ankles[side].clone().sub(new Vector3(0, seg.ankleHeight, 0)).sub(t.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir: t.clone(),
      up: UP.clone(),
      kneePole: pole ? pole(side) : t.clone().add(new Vector3(0, 0.2, 0)),
      heelLiftAllowed,
    };
  }
  return out;
}

function pesoMuerto(ctx: Ctx): Pose {
  const { seg, p, errorId } = ctx;
  const round = errorId === 'espalda_redondeada';
  const squat = errorId === 'sentadilla';
  const axial = axialAt(BASE, p, {
    lumbarFlex: round ? lerp(24, 4, p) : -6,
    thoracicFlex: round ? lerp(16, 2, p) : 0,
    neckFlex: errorId === 'cuello' ? lerp(-38, -14, p) : 4,
    scapProt: 4,
  });
  const lean = squat ? lerp(46, 3, p) : lerp(74, 3, p);
  const kappa = squat ? lerp(62, 18, p) : 18;
  const beta = squat ? lerp(24, 4, p) : lerp(-2, 4, p);
  const stance = legStance(seg, 0.03, 6);
  const hip = hipsFromLegs(seg, stance.ankles, stance.toe, beta, kappa);
  const q = qAxis(new Vector3(1, 0, 0), lean - axial.lumbarFlex - axial.thoracicFlex);
  const pelvis = new Frame(new Vector3(0, hip.y, hip.z), q);
  const feet = stanceFeet(seg, stance, undefined, false);
  const pre = solveWith(ctx, pelvis, axial, feet);
  const reach = reachFor(seg, 5, axial.wristExt);
  const hands = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    // Brazos colgando, algo por delante: las mancuernas bajan pegadas por delante de los muslos.
    const dir = new Vector3(-s * 0.05, -Math.cos(16 * DEG), Math.sin(16 * DEG)).normalize();
    const grip = pre.arms[side].gh.clone().add(dir.multiplyScalar(reach));
    hands[side] = { grip, pole: new Vector3(s, 0, -0.3).normalize(), palm: new Vector3(0, 0, -1) };
  }
  const body = solveWith(ctx, pelvis, axial, feet, hands);
  return {
    body,
    dumbbells: SIDES.map((s) => dumbbellAt(body, s)),
    loaded: SIDES.map((side) => ({ side, share: 1 })),
    bench: null,
    setup: [{ label: 'Postura', value: 'De pie, pies a la anchura de las caderas', note: 'Rodillas algo flexionadas y fijas; la cadera va atrás' }],
  };
}

function goblet(ctx: Ctx): Pose {
  const { seg, p, errorId } = ctx;
  const retro = errorId === 'retroversion';
  const axial = axialAt(BASE, p, {
    lumbarFlex: retro ? lerp(16, -2, p) : lerp(-2, -4, p),
    pelvisTilt: retro ? lerp(-18, 0, p) : lerp(4, 0, p),
    thoracicFlex: -2,
    scapProt: 6,
    scapElev: -4,
    wristExt: 20,
  });
  const lean = lerp(36, 3, p);
  const kappa = lerp(108, 6, p);
  const beta = lerp(30, 3, p);
  const stance = legStance(seg, 0.12, 20);
  const hip = hipsFromLegs(seg, stance.ankles, stance.toe, beta, kappa);
  const q = qAxis(new Vector3(1, 0, 0), lean - axial.lumbarFlex - axial.thoracicFlex);
  const pelvis = new Frame(new Vector3(0, hip.y, hip.z), q);
  // Valgo (error): la rodilla apunta hacia dentro de la línea del pie.
  const pole = (side: Side) => {
    const t = stance.toe[side];
    if (errorId !== 'valgo') return t.clone().add(new Vector3(0, 0.2, 0));
    return t.clone().applyAxisAngle(UP, -sideSign(side) * 40 * DEG).add(new Vector3(0, 0.2, 0));
  };
  const feet = stanceFeet(seg, stance, pole, true);
  const forcedHeelLift = errorId === 'talones' ? lerp(14, 2, p) : undefined;
  const preIn = { seg, anthro: ctx.anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet, forcedHeelLift };
  const pre = solveBody(preIn);
  // Mancuerna vertical delante del esternón, sujeta por la cabeza superior con las dos manos.
  const center = chestPoint(pre).add(pre.thorax.dir(0, -0.02, 0.11));
  const hands = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const grip = center.clone().add(new Vector3(s * 0.05, 0.08, 0));
    hands[side] = { grip, pole: new Vector3(s * 0.35, -1, 0.15).normalize(), palm: new Vector3(-s * 0.6, 0.8, 0).normalize() };
  }
  const body = solveBody({ ...preIn, hands });
  return {
    body,
    dumbbells: [{ center, axis: UP.clone() }],
    loaded: SIDES.map((side) => ({ side, share: 0.5 })),
    bench: null,
    setup: [{ label: 'Postura', value: 'Pies algo más anchos que las caderas, puntas a 20°', note: 'Mancuerna vertical pegada al pecho, codos abajo' }],
  };
}

const SOLVERS: Record<Ejercicio, (ctx: Ctx) => Pose> = {
  curl,
  'press-hombro': pressHombro,
  elevaciones,
  remo,
  'press-inclinado': pressInclinado,
  'peso-muerto': pesoMuerto,
  goblet,
};

export const mancuernasLogic: StationLogic<MancuernasMachine> = {
  id: 'mancuernas',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  startAtFor: (variantId) => (FROM_TOP.has(variantId) ? 'contraccion' : 'estiramiento'),
  load: MANCUERNAS_LOAD,
  defaultLoadKg: 10,
  bounds: { min: [-0.9, 0, -0.8], max: [0.9, 2.2, 1.0] },
  framePoints: (m) => {
    const pts = [new Vector3(0.55, 0, -0.45), new Vector3(-0.55, 0, -0.45), new Vector3(0.55, 0, 0.55), new Vector3(-0.55, 0, 0.55)];
    for (const d of m.dumbbells) pts.push(d.center.clone().add(new Vector3(0, 0.1, 0)), d.center.clone().add(new Vector3(0, -0.1, 0)));
    if (m.bench) {
      const b = m.bench;
      const half = b.length / 2;
      pts.push(new Vector3(b.x + 0.2, b.top, b.z - half), new Vector3(b.x - 0.2, b.top, b.z + half));
    }
    return pts;
  },
  solve(input: StationFrameInput): StationSolution<MancuernasMachine> {
    const exercise = (SOLVERS[input.variantId as Ejercicio] ? input.variantId : 'curl') as Ejercicio;
    const pose = SOLVERS[exercise]({ seg: input.seg, anthro: input.anthro, p: input.p, errorId: input.errorId });
    const load = describeLoad(MANCUERNAS_LOAD, input.loadKg);
    const forces: ContactForce[] = pose.loaded.map(({ side, share }) => ({
      limb: 'arm',
      side,
      point: pose.body.arms[side].grip.clone(),
      force: new Vector3(0, -input.loadKg * G * share, 0),
    }));
    const count = pose.dumbbells.length;
    return {
      body: pose.body,
      machine: { exercise, dumbbells: pose.dumbbells, kg: input.loadKg, bench: pose.bench },
      forces,
      setup: [
        ...pose.setup,
        { label: 'Mancuernas', value: count === 1 ? `Una de ${input.loadKg} kg` : `Dos de ${input.loadKg} kg (${2 * input.loadKg} kg)`, note: 'Elige el peso que te permita 8–12 repeticiones con buena técnica' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
