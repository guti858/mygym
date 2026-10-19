import { Vector3 } from 'three';
import type { Anthropometry, Segments } from '../engine/anthropometry';
import { NEUTRAL_AXIAL, SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type Side, type SolvedBody } from '../engine/body';
import { DEG, Frame, clamp, qAxis, sampleKeys } from '../engine/math';
import type { JointWindow } from '../engine/types';

/**
 * Piezas comunes a las estaciones: postura sentada contra un respaldo, pies apoyados,
 * alcance del brazo y ventanas articulares compartidas (mismo texto y mismos umbrales en
 * todas las máquinas).
 */

export type Keys = ReadonlyArray<{ p: number; v: number }>;
export type AxialKeys = Partial<Record<keyof AxialParams, Keys>>;

const X = new Vector3(1, 0, 0);
const UP = new Vector3(0, 1, 0);

/** Parámetros axiales interpolados por claves (p = 0 estiramiento → 1 contracción). */
export function axialAt(keys: AxialKeys, p: number, overrides: Partial<AxialParams> = {}): AxialParams {
  const a: AxialParams = { ...NEUTRAL_AXIAL };
  for (const k of Object.keys(keys) as (keyof AxialParams)[]) a[k] = sampleKeys(keys[k]!, p);
  return { ...a, ...overrides };
}

/** Busca por bisección el valor de `s` en el que `pred` pasa a cumplirse (pred monótono). */
export function bisect(lo: number, hi: number, pred: (s: number) => boolean, iters = 40): number {
  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2;
    if (pred(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Longitud efectiva antebrazo + mano hasta el centro del agarre (como en la IK del motor). */
function forearmLink(seg: Segments, wristExtDeg: number) {
  const th = wristExtDeg * DEG;
  return Math.sqrt(seg.forearm ** 2 + seg.hand ** 2 + 2 * seg.forearm * seg.hand * Math.cos(th));
}

/** Distancia hombro → agarre para una flexión de codo dada. */
export function reachFor(seg: Segments, elbowFlexDeg: number, wristExtDeg = 0): number {
  const a = seg.upperArm;
  const b = forearmLink(seg, wristExtDeg);
  const interior = (180 - elbowFlexDeg) * DEG;
  return Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(interior));
}

/** Flexión de codo (aproximada) para una distancia hombro → agarre. */
export function elbowFlexFor(seg: Segments, dist: number, wristExtDeg = 0): number {
  const a = seg.upperArm;
  const b = forearmLink(seg, wristExtDeg);
  const c = clamp((a * a + b * b - dist * dist) / (2 * a * b), -1, 1);
  return 180 - Math.acos(c) / DEG;
}

/**
 * Pelvis sentada: isquiones sobre el asiento a la altura `seatY` (z = `contactZ`) y tronco
 * reclinado `reclineDeg` hacia atrás (+) respecto a la vertical.
 */
export function seatedPelvis(seg: Segments, seatY: number, reclineDeg: number, contactZ = 0): Frame {
  const q = qAxis(X, -reclineDeg);
  const contact = new Vector3(0, seatY, contactZ);
  return new Frame(contact.clone().sub(seg.ischium.clone().applyQuaternion(q)), q);
}

/** Respaldo plano: punto del plano y normal hacia el usuario. */
export interface Backrest {
  point: Vector3;
  normal: Vector3;
}

/** Respaldo reclinado `reclineDeg` cuyo plano pasa por (0, y, z). */
export function backrestPlane(reclineDeg: number, y: number, z: number): Backrest {
  return { point: new Vector3(0, y, z), normal: new Vector3(0, Math.sin(reclineDeg * DEG), Math.cos(reclineDeg * DEG)) };
}

/**
 * Punto de la espalda alta (zona escapular) que apoya en el respaldo. La superficie del modelo
 * anatómico queda unos 2,2 % de la talla por detrás de la línea de la columna del motor.
 */
export function upperBackPoint(body: SolvedBody): Vector3 {
  const { seg } = body;
  return body.thorax.point(0, 0.62 * seg.thoracic, -0.022 * seg.H * Math.pow(seg.build, 0.8));
}

/** Punto del pecho (esternón medio) que apoya en una almohadilla frontal. */
export function chestPoint(body: SolvedBody): Vector3 {
  const { seg } = body;
  return body.thorax.point(0, 0.5 * seg.thoracic, 0.118 * seg.H * Math.pow(seg.build, 0.8));
}

/**
 * Desliza la pelvis sobre el asiento (en z) hasta que la espalda alta toque el respaldo
 * (o el pecho la almohadilla, con `contact = chestPoint` y la normal hacia el usuario).
 * Usa un cuerpo provisional sin manos: solo importa la cadena pelvis → tórax.
 */
export function fitToBackrest(
  seg: Segments,
  anthro: Anthropometry,
  pelvis: Frame,
  axial: AxialParams,
  backrest: Backrest,
  feet: Record<Side, FootTarget>,
  contact: (body: SolvedBody) => Vector3 = upperBackPoint,
): Frame {
  const body = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: seg.ischium.clone(), axial, feet });
  const d = contact(body).sub(backrest.point).dot(backrest.normal);
  const nz = backrest.normal.z;
  const dz = -d / (Math.abs(nz) < 0.2 ? Math.sign(nz || 1) * 0.2 : nz);
  return new Frame(pelvis.origin.clone().add(new Vector3(0, 0, dz)), pelvis.q.clone());
}

/**
 * Pies apoyados en el suelo con la tibia vertical, a la anchura de las caderas (+ `extraHalfWidth`)
 * y puntas `toeOutDeg` hacia fuera. Funciona con cualquier altura de asiento.
 */
export function floorFeet(
  seg: Segments,
  pelvis: Frame,
  opts: { toeOutDeg?: number; extraHalfWidth?: number; floorY?: number; shinForward?: number } = {},
): Record<Side, FootTarget> {
  const toeOut = (opts.toeOutDeg ?? 8) * DEG;
  const floorY = opts.floorY ?? 0;
  const out = {} as Record<Side, FootTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const hjc = pelvis.point(s * seg.hipHalfWidth, 0, 0);
    const ankleX = s * (seg.hipHalfWidth + (opts.extraHalfWidth ?? 0.035));
    const ankleY = floorY + seg.ankleHeight;
    const kneeY = ankleY + seg.shank;
    const dx = ankleX - hjc.x;
    const dy = kneeY - hjc.y;
    const dz = Math.sqrt(Math.max(0.0025, seg.thigh * seg.thigh * 0.995 - dx * dx - dy * dy));
    const ankleZ = hjc.z + dz + (opts.shinForward ?? 0.02);
    const toeDir = new Vector3(s * Math.sin(toeOut), 0, Math.cos(toeOut));
    out[side] = {
      heel: new Vector3(ankleX, floorY, ankleZ).sub(toeDir.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir,
      up: UP.clone(),
      heelLiftAllowed: false,
    };
  }
  return out;
}

/** Posición de un ajuste discreto (asiento, palanca…): número de posición y valor real. */
export function snapPosition(target: number, min: number, step: number, count: number) {
  const pos = clamp(Math.round((target - min) / step) + 1, 1, count);
  return { pos, value: min + step * (pos - 1) };
}

// ---------------------------------------------------------------------------------------------
// Ventanas compartidas (mismo texto y criterio en todas las estaciones)
// ---------------------------------------------------------------------------------------------

export const SHARED_WINDOWS = {
  muneca: (): JointWindow => ({
    id: 'muneca',
    metric: 'wrist.ext',
    ok: [-10, 20],
    warn: [-20, 35],
    at: 'siempre',
    label: 'Muñeca neutra',
    cue: 'Muñeca alineada con el antebrazo; el agarre apoyado en la base de la palma.',
    why: 'Las muñecas dobladas hacia atrás bajo carga sobrecargan la articulación y transmiten peor la fuerza.',
    confidence: 'practica',
  }),
  cuello: (ok: readonly [number, number] = [-10, 12], warn: readonly [number, number] = [-20, 22]): JointWindow => ({
    id: 'cuello',
    metric: 'neck.flex',
    ok,
    warn,
    at: 'siempre',
    label: 'Cuello neutro',
    cue: 'Cabeza alineada con el tronco, sin adelantar la barbilla.',
    why: 'Mover la cabeza para «ayudar» al empuje carga la columna cervical.',
    confidence: 'practica',
  }),
  codoArriba: (ok: readonly [number, number] = [5, 25], warn: readonly [number, number] = [0, 35]): JointWindow => ({
    id: 'codo_arriba',
    metric: 'elbow.flex',
    ok,
    warn,
    at: 'contraccion',
    label: 'Arriba sin bloquear los codos',
    cue: 'Extiende los brazos casi del todo, sin bloquear de golpe.',
    why: 'Bloquear el codo con carga traslada la tensión de los músculos a la articulación.',
    confidence: 'practica',
  }),
  hombrosAbajo: (ok: readonly [number, number] = [-15, 3], warn: readonly [number, number] = [-15, 10]): JointWindow => ({
    id: 'hombros_abajo',
    metric: 'scap.elev',
    ok,
    warn,
    at: 'siempre',
    label: 'Hombros lejos de las orejas',
    cue: 'Hombros abajo (depresión escapular) durante todo el recorrido.',
    why: 'Encoger los hombros da protagonismo al trapecio superior y empeora la posición del hombro.',
    confidence: 'consenso',
    sources: ['nsca'],
  }),
};

export const NSCA_SOURCE = { id: 'nsca', cite: 'Haff & Triplett (eds.), Essentials of Strength Training and Conditioning, 4.ª ed., NSCA, 2016.' };
