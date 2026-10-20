import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side } from '../../engine/body';
import type { Segments } from '../../engine/anthropometry';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { DEG, Frame, lerp, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import { axialAt, backrestPlane, fitToBackrest, seatedPelvis, type AxialKeys, type Keys } from '../common';

/**
 * Abductores / aductores: sentado, con los muslos sobre los brazos de la máquina y las almohadillas
 * por fuera (abducción) o por dentro (aducción) de las rodillas. Cada brazo gira alrededor de un eje
 * vertical bajo la cadera: el muslo se abre o se cierra en el plano horizontal y la pierna (rodilla a
 * 90° y pie en el reposapiés) le sigue.
 */

export type AbdMode = 'abduccion' | 'aduccion';

export interface AbdAddMachine {
  mode: AbdMode;
  seatY: number;
  /** Apertura de cada muslo (grados desde la línea recta al frente). */
  opening: number;
  /** Eje de giro de cada brazo, almohadilla, reposapiés. */
  pivots: Record<Side, Vector3>;
  pads: Record<Side, Vector3>;
  footrests: Record<Side, Vector3>;
  thighDirs: Record<Side, Vector3>;
  handles: Record<Side, Vector3>;
  backrest: boolean;
  startPos: number;
  stackLift: number;
  stackPlates: number;
  selectedPlates: number;
}

interface VariantGeom {
  mode: AbdMode;
  /** Apertura de cada muslo al principio (p = 0) y al final (p = 1) del recorrido. */
  open0: number;
  open1: number;
  /** Inclinación del tronco (+ adelante); con respaldo, reclinado. */
  lean: Keys;
  backrest: boolean;
}

const GEOM: Record<string, VariantGeom> = {
  abduccion: { mode: 'abduccion', open0: 4, open1: 40, lean: [{ p: 0, v: -10 }], backrest: true },
  'abduccion-inclinada': {
    mode: 'abduccion',
    open0: 4,
    open1: 38,
    lean: [
      { p: 0, v: 30 },
      { p: 1, v: 28 },
    ],
    backrest: false,
  },
  aduccion: { mode: 'aduccion', open0: 36, open1: 4, lean: [{ p: 0, v: -10 }], backrest: true },
};

export const ABD_SEAT_Y = 0.59;
const RECLINE = 10;
export const ABD_BACK = { y: 0.93, z: -0.2 };
const BACKREST = backrestPlane(RECLINE, ABD_BACK.y, ABD_BACK.z);
/** Pendiente del muslo hacia la rodilla (algo por debajo de la horizontal). */
const THIGH_DROP = 6;
const START_STEP = 6;

export const ABD_LOAD: LoadSpec = { kind: 'pila', minKg: 5, maxKg: 90, stepKg: 5, ratio: 1, label: 'Pila de placas' };

const AXIAL_KEYS: AxialKeys = {
  lumbarFlex: [{ p: 0, v: -4 }],
  thoracicFlex: [{ p: 0, v: 0 }],
  neckFlex: [{ p: 0, v: 4 }],
  scapElev: [{ p: 0, v: -4 }],
  scapProt: [{ p: 0, v: 0 }],
  wristExt: [{ p: 0, v: 4 }],
};

function axialFor(p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'pelvis') {
    // La pelvis se despega del respaldo y bascula atrás para mover más peso.
    over.pelvisTilt = lerp(-4, -16, p);
    over.lumbarFlex = lerp(4, 15, p);
  }
  return axialAt(AXIAL_KEYS, p, over);
}

function leanFor(geom: VariantGeom, p: number, errorId: string | null): number {
  if (errorId === 'balanceo') {
    // Inercia con el tronco: se echa adelante (o se levanta, si va inclinado) al abrir.
    return geom.backrest ? sampleKeys([{ p: 0, v: -10 }, { p: 0.5, v: 6 }, { p: 1, v: 14 }], p) : sampleKeys([{ p: 0, v: 32 }, { p: 1, v: 6 }], p);
  }
  return sampleKeys(geom.lean, p);
}

function openingFor(geom: VariantGeom, p: number, errorId: string | null): number {
  // Rango inicial excesivo (aducción): el pasador deja las piernas muy abiertas al empezar.
  if (errorId === 'rango_inicial') return lerp(58, geom.open1, p);
  return lerp(geom.open0, geom.open1, p);
}

/** Dirección del muslo (horizontal, algo hacia abajo) abierto `opening` grados hacia su lado. */
function thighDir(s: number, opening: number): Vector3 {
  const a = opening * DEG;
  const d = THIGH_DROP * DEG;
  return new Vector3(s * Math.sin(a) * Math.cos(d), -Math.sin(d), Math.cos(a) * Math.cos(d));
}

/** Pierna con la rodilla a 90° y el pie en el reposapiés, siguiendo al muslo. */
function legTargets(seg: Segments, pelvis: Frame, opening: number): { feet: Record<Side, FootTarget>; knees: Record<Side, Vector3>; dirs: Record<Side, Vector3> } {
  const feet = {} as Record<Side, FootTarget>;
  const knees = {} as Record<Side, Vector3>;
  const dirs = {} as Record<Side, Vector3>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const hjc = pelvis.point(s * seg.hipHalfWidth, 0, 0);
    const t = thighDir(s, opening);
    const knee = hjc.clone().add(t.clone().multiplyScalar(seg.thigh));
    // Tibia a 90° del muslo, en su plano vertical: hacia abajo y un poco hacia atrás.
    const horiz = new Vector3(t.x, 0, t.z).normalize();
    const d = THIGH_DROP * DEG;
    const shankDir = horiz.clone().multiplyScalar(-Math.sin(d)).add(new Vector3(0, -Math.cos(d), 0));
    const ankle = knee.clone().add(shankDir.multiplyScalar(seg.shank));
    const up = new Vector3(0, 1, 0);
    feet[side] = {
      heel: ankle.clone().sub(up.clone().multiplyScalar(seg.ankleHeight)).sub(horiz.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir: horiz.clone(),
      up,
      kneePole: t.clone().add(new Vector3(0, 0.3, 0)).normalize(),
      heelLiftAllowed: false,
    };
    knees[side] = knee;
    dirs[side] = t;
  }
  return { feet, knees, dirs };
}

export const abdAddLogic: StationLogic<AbdAddMachine> = {
  id: 'abd_add',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: ABD_LOAD,
  defaultLoadKg: 35,
  bounds: { min: [-0.85, 0, -0.75], max: [0.85, 1.75, 0.95] },
  framePoints: (m) => [
    new Vector3(0.75, 0, -0.7),
    new Vector3(-0.75, 0, -0.7),
    new Vector3(0.75, 0, 0.85),
    new Vector3(-0.75, 0, 0.85),
    new Vector3(0, 1.6, -0.55),
    m.pads.L.clone().add(new Vector3(0.12, 0, 0)),
    m.pads.R.clone().add(new Vector3(-0.12, 0, 0)),
  ],
  solve(input: StationFrameInput): StationSolution<AbdAddMachine> {
    const { seg, anthro, p, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM.abduccion!;
    const axial = axialFor(p, errorId);
    const lean = leanFor(geom, p, errorId);
    const opening = openingFor(geom, p, errorId);

    // Pelvis sentada con el tronco a `lean`. Con respaldo, el usuario se desliza hasta apoyar la
    // espalda en la postura ideal; si después el tronco se mueve (errores), se separa del respaldo.
    const sit = (ax: AxialParams, leanDeg: number) => seatedPelvis(seg, ABD_SEAT_Y, -(leanDeg - ax.lumbarFlex - ax.thoracicFlex), -0.02);
    let pelvis = sit(axial, lean);
    if (geom.backrest) {
      const ax0 = axialFor(0, null);
      const ideal = sit(ax0, sampleKeys(geom.lean, 0));
      const fitted = fitToBackrest(seg, anthro, ideal, ax0, BACKREST, legTargets(seg, ideal, opening).feet);
      pelvis = new Frame(pelvis.origin.clone().add(new Vector3(0, 0, fitted.origin.z - ideal.origin.z)), pelvis.q.clone());
    }
    const legs = legTargets(seg, pelvis, opening);

    // Manos en los agarres a los lados del asiento.
    const pre = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: seg.ischium.clone(), axial, feet: legs.feet });
    const handles = {} as Record<Side, Vector3>;
    const hands = {} as Record<Side, HandTarget>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const grip = new Vector3(s * (seg.hipHalfWidth + 0.22), ABD_SEAT_Y + 0.16, pelvis.origin.z + 0.12);
      handles[side] = grip;
      hands[side] = { grip: grip.clone(), pole: pre.thorax.dir(s * 0.6, -0.2, -1).normalize(), palm: new Vector3(-s, 0, 0) };
    }
    const body = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: seg.ischium.clone(), axial, feet: legs.feet, hands });

    // Brazos de la máquina: eje bajo la cadera, almohadilla junto a la rodilla (fuera o dentro) y reposapiés.
    const pivots = {} as Record<Side, Vector3>;
    const pads = {} as Record<Side, Vector3>;
    const footrests = {} as Record<Side, Vector3>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const hjc = body.legs[side].hjc;
      pivots[side] = new Vector3(hjc.x, ABD_SEAT_Y - 0.1, hjc.z);
      const t = legs.dirs[side];
      const outward = new Vector3(s * t.z, 0, -s * t.x).normalize();
      const along = body.legs[side].hjc.clone().lerp(body.legs[side].knee, 0.82);
      const off = seg.r.thigh + 0.04;
      pads[side] = along.add(outward.multiplyScalar(geom.mode === 'abduccion' ? off : -off));
      footrests[side] = body.legs[side].heel.clone().lerp(body.legs[side].toe, 0.45).add(new Vector3(0, -0.02, 0));
    }

    const load = describeLoad(ABD_LOAD, input.loadKg);
    // La máquina resiste el movimiento: empuja hacia dentro en la abducción y hacia fuera en la aducción.
    const forces: ContactForce[] = SIDES.map((side) => {
      const s = sideSign(side);
      const t = legs.dirs[side];
      const outward = new Vector3(s * t.z, 0, -s * t.x).normalize();
      const dir = geom.mode === 'abduccion' ? outward.clone().negate() : outward.clone();
      return { limb: 'leg', side, point: pads[side].clone(), force: dir.multiplyScalar(load.forceN / 2) };
    });
    const startOpening = openingFor(geom, 0, errorId);
    const startPos = Math.max(1, Math.round((geom.mode === 'aduccion' ? startOpening : 60 - startOpening) / START_STEP));
    return {
      body,
      machine: {
        mode: geom.mode,
        seatY: ABD_SEAT_Y,
        opening,
        pivots,
        pads,
        footrests,
        thighDirs: legs.dirs,
        handles,
        backrest: geom.backrest,
        startPos,
        stackLift: Math.abs(opening - startOpening) * DEG * 0.18,
        stackPlates: 18,
        selectedPlates: Math.round(input.loadKg / 5),
      },
      forces,
      setup: [
        { label: 'Asiento', value: 'Caderas al fondo del asiento', note: geom.backrest ? 'Espalda y pelvis apoyadas en el respaldo' : 'Tronco inclinado unos 30° adelante, sin apoyo' },
        {
          label: 'Rango inicial',
          value: `Posición ${startPos} (${Math.round(2 * startOpening)}° entre muslos)`,
          note: geom.mode === 'aduccion' ? 'Apertura inicial cómoda: no la máxima' : 'Piernas casi juntas al empezar',
        },
        { label: 'Almohadillas', value: geom.mode === 'abduccion' ? 'Por fuera de las rodillas' : 'Por dentro de las rodillas', note: 'Sobre la parte distal del muslo, justo por encima de la rodilla' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
