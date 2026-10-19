import { Quaternion, Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side, type SolvedBody } from '../../engine/body';
import type { Anthropometry, Segments } from '../../engine/anthropometry';
import { describeLoad, platesPerSide, type LoadSpec } from '../../engine/load';
import { DEG, Frame, lerp, qAxis, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import { axialAt, bisect, chestPoint, elbowFlexFor, reachFor, snapPosition, type AxialKeys, type Keys } from '../common';

/**
 * Remo en T: palanca anclada al suelo por detrás del usuario que pasa entre sus pies; los discos
 * van en el extremo y el maneral describe un arco alrededor del anclaje. Dos posturas: libre (bisagra
 * de cadera con rodillas semiflexionadas) o con el pecho apoyado en una almohadilla. Dos agarres:
 * neutro estrecho (codos hacia la cadera) o prono ancho (codos abiertos).
 *
 * El usuario se coloca de modo que, con los brazos extendidos, el maneral quede bajo los hombros. En
 * cada fotograma el ángulo de la palanca es el que da la flexión de codo buscada con el cuerpo real:
 * si el tronco se levanta o se redondea (errores), la palanca se mueve con él.
 */

export type RemoGrip = 'neutro' | 'prono';

export interface RemoMachine {
  supported: boolean;
  grip: RemoGrip;
  /** Ángulo de la palanca sobre la horizontal (grados). */
  angle: number;
  pivot: Vector3;
  /** Punto de la palanca donde se fija el maneral, travesaño del maneral (por encima) y eje de los discos. */
  handle: Vector3;
  crossbar: Vector3;
  sleeve: Vector3;
  grips: Record<Side, Vector3>;
  platesPerSide: number[];
  /** Almohadilla de pecho (solo con apoyo): centro, orientación y posición de ajuste. */
  pad: { center: Vector3; q: Quaternion; pos: number } | null;
  platformY: number;
}

interface PostureGeom {
  supported: boolean;
  lean: Keys;
  kneeDeg: number;
}

const POSTURES: Record<'apoyo' | 'libre', PostureGeom> = {
  apoyo: {
    supported: true,
    lean: [{ p: 0, v: 47 }],
    kneeDeg: 14,
  },
  libre: {
    supported: false,
    lean: [
      { p: 0, v: 54 },
      { p: 1, v: 50 },
    ],
    kneeDeg: 24,
  },
};

interface GripGeom {
  grip: RemoGrip;
  /** Media separación de los agarres (m) y caída bajo la palanca. */
  half: number;
  drop: number;
  flexTop: number;
  pole: readonly [number, number, number];
}

const GRIPS: Record<RemoGrip, GripGeom> = {
  neutro: { grip: 'neutro', half: 0.075, drop: 0.07, flexTop: 108, pole: [0.3, -0.45, -1] },
  prono: { grip: 'prono', half: 0.29, drop: 0.0, flexTop: 96, pole: [1, 0.05, -0.55] },
};

export const REMO_PLATFORM_Y = 0.06;
export const REMO_PIVOT = new Vector3(0, 0.12, -0.95);
/** Del anclaje al maneral y al eje de los discos. */
export const REMO_HANDLE_L = 1.5;
export const REMO_SLEEVE_L = 1.64;
/** El travesaño del maneral va sobre un soporte por encima de la palanca: así los discos pasan por debajo del tronco. */
export const REMO_HANDLE_RISE = 0.24;
const FLEX_START = 10;
/** Separación extra de los tobillos respecto a las caderas (la palanca pasa entre los pies). */
const FEET_EXTRA = 0.07;
/** Tobillos por delante de las caderas en la bisagra. */
const ANKLE_AHEAD = 0.13;

export const REMO_LOAD: LoadSpec = { kind: 'discos', baseKg: 10, base: 'palanca', maxPlatesKgPerSide: 50, effectiveFactor: REMO_SLEEVE_L / REMO_HANDLE_L, label: 'Palanca + discos' };

const AXIAL_KEYS: AxialKeys = {
  scapProt: [
    { p: 0, v: 10 },
    { p: 0.35, v: 0 },
    { p: 1, v: -20 },
  ],
  scapElev: [
    { p: 0, v: -2 },
    { p: 1, v: -6 },
  ],
  lumbarFlex: [{ p: 0, v: -4 }],
  thoracicFlex: [
    { p: 0, v: 2 },
    { p: 1, v: -4 },
  ],
  neckFlex: [{ p: 0, v: 4 }],
  wristExt: [{ p: 0, v: 4 }],
};

function axialFor(p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'espalda_redondeada') {
    over.lumbarFlex = lerp(20, 24, p);
    over.thoracicFlex = lerp(16, 12, p);
  } else if (errorId === 'encogimiento') {
    over.scapElev = lerp(14, 22, p);
  } else if (errorId === 'cuello') {
    over.neckFlex = lerp(-26, -36, p);
  }
  return axialAt(AXIAL_KEYS, p, over);
}

function leanFor(posture: PostureGeom, p: number, errorId: string | null): number {
  // Tirón con la cadera (libre) o pecho que se despega (apoyo): el tronco se levanta al tirar.
  if (errorId === 'tiron_cadera') return sampleKeys([{ p: 0, v: 56 }, { p: 0.5, v: 40 }, { p: 1, v: 24 }], p);
  if (errorId === 'pecho_despegado') return sampleKeys([{ p: 0, v: 47 }, { p: 0.4, v: 44 }, { p: 1, v: 26 }], p);
  return sampleKeys(posture.lean, p);
}

/**
 * De pie en bisagra: pelvis a la altura que deja la rodilla con `kneeDeg` de flexión con los
 * tobillos sobre la plataforma, algo por delante de las caderas. La pelvis queda en z = 0.
 */
function standingPlacement(seg: Segments, ax: AxialParams, leanDeg: number, kneeDeg: number) {
  const q = qAxis(new Vector3(1, 0, 0), leanDeg - ax.lumbarFlex - ax.thoracicFlex);
  const interior = (180 - kneeDeg) * DEG;
  const d = Math.sqrt(seg.thigh ** 2 + seg.shank ** 2 - 2 * seg.thigh * seg.shank * Math.cos(interior));
  const vert = Math.sqrt(Math.max(0.04, d * d - FEET_EXTRA ** 2 - ANKLE_AHEAD ** 2));
  const pelvis = new Frame(new Vector3(0, REMO_PLATFORM_Y + seg.ankleHeight + vert, 0), q);
  const feet = {} as Record<Side, FootTarget>;
  const toeOut = 10 * DEG;
  for (const side of SIDES) {
    const s = sideSign(side);
    const toeDir = new Vector3(s * Math.sin(toeOut), 0, Math.cos(toeOut));
    const ankle = new Vector3(s * (seg.hipHalfWidth + FEET_EXTRA), REMO_PLATFORM_Y + seg.ankleHeight, ANKLE_AHEAD);
    feet[side] = {
      heel: ankle.clone().sub(new Vector3(0, seg.ankleHeight, 0)).sub(toeDir.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir,
      up: new Vector3(0, 1, 0),
      kneePole: new Vector3(s * 0.2, 0, 1),
      heelLiftAllowed: false,
    };
  }
  return { pelvis, feet };
}

const shifted = (frame: Frame, dz: number) => new Frame(frame.origin.clone().add(new Vector3(0, 0, dz)), frame.q.clone());
function shiftedFeet(feet: Record<Side, FootTarget>, dz: number): Record<Side, FootTarget> {
  const out = {} as Record<Side, FootTarget>;
  for (const side of SIDES) out[side] = { ...feet[side], heel: feet[side].heel.clone().add(new Vector3(0, 0, dz)) };
  return out;
}

/** Maneral (centro) para un ángulo de palanca. */
const handleAt = (angleDeg: number, l = REMO_HANDLE_L) =>
  REMO_PIVOT.clone().add(new Vector3(0, Math.sin(angleDeg * DEG) * l, Math.cos(angleDeg * DEG) * l));

const crossbarAt = (angleDeg: number) => handleAt(angleDeg).add(new Vector3(0, REMO_HANDLE_RISE, 0));

function gripsAt(g: GripGeom, angleDeg: number): Record<Side, Vector3> {
  const h = crossbarAt(angleDeg);
  const out = {} as Record<Side, Vector3>;
  for (const side of SIDES) out[side] = h.clone().add(new Vector3(sideSign(side) * g.half, -g.drop, 0));
  return out;
}

function bodyAt(seg: Segments, anthro: Anthropometry, place: ReturnType<typeof standingPlacement>, ax: AxialParams): SolvedBody {
  return solveBody({ seg, anthro, pelvisRef: place.pelvis, pelvisPivot: new Vector3(), axial: ax, feet: place.feet });
}

export const remoLogic: StationLogic<RemoMachine> = {
  id: 'remo_t',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: REMO_LOAD,
  defaultLoadKg: 30,
  bounds: { min: [-0.7, 0, -1.1], max: [0.7, 1.7, 1.05] },
  framePoints: (m) => [
    new Vector3(0.6, 0, -1.05),
    new Vector3(-0.6, 0, -1.05),
    new Vector3(0.6, 0, m.sleeve.z + 0.3),
    new Vector3(-0.6, 0, m.sleeve.z + 0.3),
    m.sleeve.clone().add(new Vector3(0.45, 0.24, 0.24)),
    m.sleeve.clone().add(new Vector3(-0.45, 0.24, 0.24)),
  ],
  solve(input: StationFrameInput): StationSolution<RemoMachine> {
    const { seg, anthro, p, errorId } = input;
    const [postureId, gripId] = input.variantId.split('-') as ['apoyo' | 'libre', RemoGrip];
    const posture = POSTURES[postureId] ?? POSTURES.apoyo;
    const g = GRIPS[gripId] ?? GRIPS.neutro;

    // Colocación (técnica ideal, inicio): maneral bajo los hombros con los brazos extendidos.
    const ax0 = axialFor(0, null);
    const place0 = standingPlacement(seg, ax0, sampleKeys(posture.lean, 0), posture.kneeDeg);
    const ref = bodyAt(seg, anthro, place0, ax0);
    const ghHalf = (Math.abs(ref.arms.L.gh.x) + Math.abs(ref.arms.R.gh.x)) / 2;
    const ghMid = ref.arms.L.gh.clone().add(ref.arms.R.gh).multiplyScalar(0.5);
    const reach0 = reachFor(seg, FLEX_START, ax0.wristExt);
    const dx = g.half - ghHalf;
    const gripMid = ghMid.clone().sub(new Vector3(0, Math.sqrt(Math.max(0.04, reach0 * reach0 - dx * dx)), 0));
    const handle0 = gripMid.clone().add(new Vector3(0, g.drop - REMO_HANDLE_RISE, 0));
    const dy = handle0.y - REMO_PIVOT.y;
    const handleZ = REMO_PIVOT.z + Math.sqrt(Math.max(0.01, REMO_HANDLE_L ** 2 - dy * dy));
    // El usuario se coloca a lo largo de la palanca (z) para que el maneral caiga bajo sus hombros.
    const dzUser = handleZ - handle0.z;

    // Almohadilla de pecho (apoyo): regulada para tocar el esternón en la postura inicial.
    let pad: RemoMachine['pad'] = null;
    if (posture.supported) {
      // Borde superior a la altura del esternón alto: la cabeza queda fuera del apoyo.
      const chest = chestPoint(ref).add(new Vector3(0, 0, dzUser));
      const center = chest.clone().add(ref.thorax.dir(0, -0.06, 0.035));
      pad = { center, q: ref.thorax.q.clone(), pos: snapPosition(center.y, 0.6, 0.025, 20).pos };
    }

    // Postura de este fotograma (con el error, si lo hay) en el mismo sitio.
    const axial = axialFor(p, errorId);
    const lean = leanFor(posture, p, errorId);
    const placeP = standingPlacement(seg, axial, lean, posture.kneeDeg);
    const pelvis = shifted(placeP.pelvis, dzUser);
    const feet = shiftedFeet(placeP.feet, dzUser);
    const pre = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet });

    // Ángulo de la palanca: el que da la flexión de codo buscada (entre la posición más baja y el
    // punto del arco más cercano al hombro).
    const flexAt = (angle: number) => elbowFlexFor(seg, pre.arms.L.gh.distanceTo(gripsAt(g, angle).L), axial.wristExt);
    let near = -10;
    for (let a = -10, best = Infinity; a <= 70; a += 0.5) {
      const d = pre.arms.L.gh.distanceTo(gripsAt(g, a).L);
      if (d < best) {
        best = d;
        near = a;
      }
    }
    const minAngle = Math.asin((0.235 - REMO_PIVOT.y) / REMO_SLEEVE_L) / DEG; // discos apoyados en el suelo
    const flexTarget = errorId === 'recorrido_corto' ? lerp(FLEX_START, 60, p) : lerp(FLEX_START, g.flexTop, p);
    const angle = Math.max(minAngle, flexAt(minAngle) >= flexTarget ? minAngle : bisect(minAngle, near, (a) => flexAt(a) >= flexTarget));

    const grips = gripsAt(g, angle);
    const hands = {} as Record<Side, HandTarget>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const pole = pre.thorax.dir(s * g.pole[0], g.pole[1], g.pole[2]);
      const palm = g.grip === 'neutro' ? new Vector3(-s, 0, 0) : new Vector3(0, 0, -1);
      hands[side] = { grip: grips[side].clone(), pole: pole.normalize(), palm };
    }
    const body = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet, hands });

    const load = describeLoad(REMO_LOAD, input.loadKg);
    const forces: ContactForce[] = SIDES.map((side) => ({ limb: 'arm', side, point: grips[side].clone(), force: new Vector3(0, -load.forceN / 2, 0) }));
    const ankleZ = feet.L.heel.z + seg.heelToAnkle;
    const gripText = g.grip === 'neutro' ? `Neutro estrecho (${Math.round(g.half * 200)} cm)` : `Prono ancho (${Math.round(g.half * 200)} cm)`;
    return {
      body,
      machine: {
        supported: posture.supported,
        grip: g.grip,
        angle,
        pivot: REMO_PIVOT.clone(),
        handle: handleAt(angle),
        crossbar: crossbarAt(angle),
        sleeve: handleAt(angle, REMO_SLEEVE_L),
        grips,
        platesPerSide: platesPerSide(input.loadKg / 2),
        pad,
        platformY: REMO_PLATFORM_Y,
      },
      forces,
      setup: [
        {
          label: 'Posición',
          value: `Tobillos a ${Math.round((ankleZ - REMO_PIVOT.z) * 100)} cm del anclaje`,
          note: 'Con los brazos extendidos, el maneral queda bajo los hombros',
        },
        ...(pad
          ? [{ label: 'Almohadilla', value: `Posición ${pad.pos}`, note: 'Apoya el esternón, no el abdomen; la cabeza queda fuera' }]
          : [{ label: 'Pies', value: 'A la anchura de las caderas, a ambos lados de la palanca', note: 'Rodillas semiflexionadas y peso en el centro del pie' }]),
        { label: 'Agarre', value: gripText, note: g.grip === 'neutro' ? 'Codos hacia la cadera' : 'Codos abiertos, hacia los lados' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
