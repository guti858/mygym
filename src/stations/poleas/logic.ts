import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side, type SolvedBody } from '../../engine/body';
import type { Segments } from '../../engine/anthropometry';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { DEG, Frame, lerp, qAxis, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import { axialAt, type AxialKeys, type Keys } from '../common';

/**
 * Poleas (columna con polea de altura regulable). De pie, el húmero queda fijo (codos pegados o
 * brazos arriba) y solo gira el antebrazo alrededor del codo: curl con barra o cuerda (polea baja),
 * extensión de tríceps en polea alta y extensión sobre la cabeza de espaldas a la columna.
 */

export type PoleaAttachment = 'barra' | 'cuerda';

export interface PoleasMachine {
  /** +1: la polea mira hacia −Z y el usuario está delante, de cara a la columna; −1: de espaldas. */
  facing: 1 | -1;
  pulley: Vector3;
  pulleyPos: number;
  attachment: PoleaAttachment;
  /** Punto de enganche del accesorio (centro de la barra o nudo de la cuerda) y manos. */
  hook: Vector3;
  hands: Record<Side, Vector3>;
  stackLift: number;
  stackPlates: number;
  selectedPlates: number;
}

interface VariantGeom {
  attachment: PoleaAttachment;
  /** Polea: altura (m) y cara de la columna. */
  pulleyY: number;
  facing: 1 | -1;
  /** Tobillos respecto a la columna (z). */
  ankleZ: number;
  lean: Keys;
  kneeDeg: number;
  /** Húmero: flexión sagital y separación lateral (grados), fijos. */
  shoulderFlex: number;
  abd: number;
  /** Flexión de codo en estiramiento (p = 0) y en contracción (p = 1). */
  elbow0: number;
  elbow1: number;
  palm: 'supino' | 'neutro' | 'prono';
  axial: AxialKeys;
}

const BASE_AXIAL: AxialKeys = {
  scapElev: [{ p: 0, v: -3 }],
  scapProt: [{ p: 0, v: -4 }],
  lumbarFlex: [{ p: 0, v: -4 }],
  thoracicFlex: [{ p: 0, v: 0 }],
  neckFlex: [{ p: 0, v: 3 }],
  wristExt: [{ p: 0, v: 2 }],
};

// Codos pegados pero algo por delante del tronco: abajo, la barra queda delante de los muslos.
const CURL = { attachment: 'barra', pulleyY: 0.2, facing: 1, ankleZ: -0.4, lean: [{ p: 0, v: 2 }], kneeDeg: 8, shoulderFlex: 12, abd: 7, elbow0: 10, elbow1: 135, axial: BASE_AXIAL } as const;

const GEOM: Record<string, VariantGeom> = {
  'curl-barra': { ...CURL, palm: 'supino' },
  'curl-cuerda': { ...CURL, attachment: 'cuerda', palm: 'neutro', abd: 4 },
  'triceps-alta': {
    attachment: 'barra',
    pulleyY: 2.02,
    facing: 1,
    // Rodillas casi extendidas y codos algo por delante: abajo, la barra queda delante de los muslos
    // y el cable sube por delante del pecho.
    ankleZ: -0.5,
    lean: [{ p: 0, v: 8 }],
    kneeDeg: 5,
    shoulderFlex: 13,
    abd: 8,
    elbow0: 95,
    elbow1: 6,
    palm: 'prono',
    axial: BASE_AXIAL,
  },
  'triceps-cabeza': {
    attachment: 'cuerda',
    pulleyY: 1.72,
    facing: -1,
    ankleZ: 0.62,
    lean: [{ p: 0, v: 22 }],
    kneeDeg: 16,
    shoulderFlex: 158,
    abd: 10,
    elbow0: 130,
    elbow1: 8,
    palm: 'neutro',
    // Con los brazos por encima de la cabeza la escápula se eleva y rota: es parte del gesto.
    axial: { ...BASE_AXIAL, scapElev: [{ p: 0, v: 8 }], scapProt: [{ p: 0, v: 2 }], lumbarFlex: [{ p: 0, v: -6 }] },
  },
};

/** Columna en z = 0; carro y polea por la cara del usuario. */
export const POLEA_CARRIAGE_Z = 0.09;
const PULLEY_STEP = 0.1;
const PULLEY_MIN = 0.2;
const PULLEY_COUNT = 19;

export const POLEAS_LOAD: LoadSpec = { kind: 'pila', minKg: 5, maxKg: 90, stepKg: 5, ratio: 2, label: 'Pila de placas · polea 2:1' };

function axialFor(geom: VariantGeom, p: number, errorId: string | null, variantId: string): AxialParams {
  const over: Partial<AxialParams> = {};
  const curl = variantId.startsWith('curl');
  if (errorId === 'encogimiento') over.scapElev = variantId === 'triceps-cabeza' ? 30 : 16;
  else if (errorId === 'munecas') over.wristExt = curl ? lerp(-8, -40, p) : lerp(10, 40, p);
  else if (errorId === 'arco_lumbar') over.lumbarFlex = lerp(-12, -26, p);
  else if (errorId === 'balanceo' && curl) over.lumbarFlex = lerp(-4, -14, p);
  return axialAt(geom.axial, p, over);
}

function leanFor(geom: VariantGeom, p: number, errorId: string | null, variantId: string): number {
  if (errorId === 'balanceo') {
    // Curl: el tronco se echa atrás para subir la barra. Tríceps: se vuelca sobre la barra.
    return variantId.startsWith('curl') ? sampleKeys([{ p: 0, v: 4 }, { p: 0.5, v: -10 }, { p: 1, v: -22 }], p) : lerp(12, 36, p);
  }
  return sampleKeys(geom.lean, p);
}

function shoulderFlexFor(geom: VariantGeom, p: number, errorId: string | null, variantId: string): number {
  if (errorId !== 'codos') return geom.shoulderFlex;
  // Curl: los codos avanzan al subir. Polea alta: suben al estirar. Sobre la cabeza: caen hacia delante.
  if (variantId.startsWith('curl')) return lerp(12, 44, p);
  if (variantId === 'triceps-alta') return lerp(38, 6, p);
  return lerp(122, 140, p);
}

function elbowFor(geom: VariantGeom, p: number, errorId: string | null): number {
  if (errorId === 'recorrido_parcial') {
    const span = geom.elbow1 - geom.elbow0;
    return lerp(geom.elbow0 + 0.3 * span, geom.elbow0 + 0.7 * span, p);
  }
  return lerp(geom.elbow0, geom.elbow1, p);
}

/** De pie: pelvis a la altura que deja la rodilla con `kneeDeg` y los tobillos casi bajo las caderas. */
function standing(seg: Segments, ax: AxialParams, leanDeg: number, kneeDeg: number, ankleZ: number) {
  const q = qAxis(new Vector3(1, 0, 0), leanDeg - ax.lumbarFlex - ax.thoracicFlex);
  const interior = (180 - kneeDeg) * DEG;
  const d = Math.sqrt(seg.thigh ** 2 + seg.shank ** 2 - 2 * seg.thigh * seg.shank * Math.cos(interior));
  const extra = 0.03;
  const ahead = 0.04;
  const vert = Math.sqrt(Math.max(0.04, d * d - extra * extra - ahead * ahead));
  const pelvis = new Frame(new Vector3(0, seg.ankleHeight + vert, ankleZ - ahead), q);
  const feet = {} as Record<Side, FootTarget>;
  const toeOut = 8 * DEG;
  for (const side of SIDES) {
    const s = sideSign(side);
    const toeDir = new Vector3(s * Math.sin(toeOut), 0, Math.cos(toeOut));
    const ankle = new Vector3(s * (seg.hipHalfWidth + extra), seg.ankleHeight, ankleZ);
    feet[side] = {
      heel: ankle.clone().sub(new Vector3(0, seg.ankleHeight, 0)).sub(toeDir.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir,
      up: new Vector3(0, 1, 0),
      kneePole: new Vector3(s * 0.15, 0, 1),
      heelLiftAllowed: false,
    };
  }
  return { pelvis, feet };
}

/** Mano a partir del húmero fijo y la flexión del codo (en el plano sagital del brazo). */
function armTarget(body: SolvedBody, seg: Segments, side: Side, flexDeg: number, abdDeg: number, elbowDeg: number, wristExt: number) {
  const s = sideSign(side);
  const th = body.thorax;
  const phi = flexDeg * DEG;
  const a = abdDeg * DEG;
  const u = th.dir(s * Math.sin(a), -Math.cos(phi) * Math.cos(a), Math.sin(phi) * Math.cos(a)).normalize();
  // Cara anterior del brazo: hacia ella se pliega el antebrazo al flexionar el codo.
  const ant = th.dir(0, Math.sin(phi), Math.cos(phi));
  ant.sub(u.clone().multiplyScalar(ant.dot(u))).normalize();
  const gh = body.arms[side].gh;
  const elbow = gh.clone().add(u.clone().multiplyScalar(seg.upperArm));
  const e = elbowDeg * DEG;
  const f = u.clone().multiplyScalar(Math.cos(e)).add(ant.clone().multiplyScalar(Math.sin(e))).normalize();
  const w = wristExt * DEG;
  const link = Math.sqrt(seg.forearm ** 2 + seg.hand ** 2 + 2 * seg.forearm * seg.hand * Math.cos(w));
  const grip = elbow.clone().add(f.clone().multiplyScalar(link));
  // Polo: el codo donde lo queremos (perpendicular a la línea hombro → mano).
  const d = grip.clone().sub(gh).normalize();
  const pole = elbow.clone().sub(gh.clone().add(d.clone().multiplyScalar(elbow.clone().sub(gh).dot(d))));
  // Cara anterior del antebrazo (palma en supinación).
  const foreAnt = ant.clone().multiplyScalar(Math.cos(e)).sub(u.clone().multiplyScalar(Math.sin(e))).normalize();
  return { grip, pole: pole.lengthSq() > 1e-8 ? pole.normalize() : ant.clone(), foreAnt };
}

export const poleasLogic: StationLogic<PoleasMachine> = {
  id: 'poleas',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: POLEAS_LOAD,
  defaultLoadKg: 20,
  bounds: { min: [-0.55, 0, -0.85], max: [0.55, 2.3, 1.35] },
  framePoints: (m) => [
    new Vector3(0.35, 2.3, 0),
    new Vector3(-0.35, 2.3, 0),
    new Vector3(0.35, 0, -0.25),
    new Vector3(-0.35, 0, -0.25),
    new Vector3(0.35, 0, 0.25),
    new Vector3(-0.35, 0, 0.25),
    m.hook.clone().add(new Vector3(0.3, 0, 0)),
    m.hook.clone().add(new Vector3(-0.3, 0, 0)),
  ],
  solve(input: StationFrameInput): StationSolution<PoleasMachine> {
    const { seg, anthro, p, errorId } = input;
    const variantId = GEOM[input.variantId] ? input.variantId : 'curl-barra';
    const geom = GEOM[variantId]!;
    /** Postura y manos en un instante `pp` del recorrido. */
    const frameAt = (pp: number) => {
      const axial = axialFor(geom, pp, errorId, variantId);
      const place = standing(seg, axial, leanFor(geom, pp, errorId, variantId), geom.kneeDeg, geom.ankleZ);
      const pre = solveBody({ seg, anthro, pelvisRef: place.pelvis, pelvisPivot: new Vector3(), axial, feet: place.feet });
      const flex = shoulderFlexFor(geom, pp, errorId, variantId);
      const elbowDeg = elbowFor(geom, pp, errorId);
      const hands = {} as Record<Side, HandTarget>;
      const handPos = {} as Record<Side, Vector3>;
      for (const side of SIDES) {
        const s = sideSign(side);
        const t = armTarget(pre, seg, side, flex, geom.abd, elbowDeg, axial.wristExt);
        const palm = geom.palm === 'supino' ? t.foreAnt.clone() : geom.palm === 'prono' ? t.foreAnt.clone().negate() : pre.thorax.dir(-s, 0, 0);
        hands[side] = { grip: t.grip, pole: t.pole, palm };
        handPos[side] = t.grip;
      }
      return { axial, place, hands, handPos };
    };
    const cur = frameAt(p);
    const { axial, place, hands, handPos } = cur;
    const body = solveBody({ seg, anthro, pelvisRef: place.pelvis, pelvisPivot: new Vector3(), axial, feet: place.feet, hands });

    const pulleyPos = Math.round((geom.pulleyY - PULLEY_MIN) / PULLEY_STEP) + 1;
    const pulley = new Vector3(0, PULLEY_MIN + (Math.min(PULLEY_COUNT, pulleyPos) - 1) * PULLEY_STEP, -geom.facing * POLEA_CARRIAGE_Z);
    // Barra: el cable se engancha en el centro; cuerda: el nudo queda unos centímetros hacia la polea.
    const hookFor = (hp: Record<Side, Vector3>) => {
      const mid = hp.L.clone().add(hp.R).multiplyScalar(0.5);
      return geom.attachment === 'barra' ? mid : mid.add(pulley.clone().sub(mid).normalize().multiplyScalar(0.12));
    };
    const hook = hookFor(handPos);

    const load = describeLoad(POLEAS_LOAD, input.loadKg);
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: handPos[side].clone(),
      force: pulley.clone().sub(handPos[side]).normalize().multiplyScalar(load.forceN / 2),
    }));
    // Desplazamiento de la pila (polea 2:1: la mitad de lo que se alarga el cable).
    const start = p === 0 ? hook : hookFor(frameAt(0).handPos);
    const stackLift = Math.max(0, (hook.distanceTo(pulley) - start.distanceTo(pulley)) / POLEAS_LOAD.ratio);

    const cm = (v: number) => Math.round(v * 100);
    return {
      body,
      machine: {
        facing: geom.facing,
        pulley,
        pulleyPos,
        attachment: geom.attachment,
        hook,
        hands: handPos,
        stackLift,
        stackPlates: 18,
        selectedPlates: Math.round(input.loadKg / 5),
      },
      forces,
      setup: [
        {
          label: 'Polea',
          value: `${geom.pulleyY < 1 ? 'Baja' : geom.facing === 1 ? 'Alta' : 'Media-alta'} · posición ${pulleyPos} (${cm(pulley.y)} cm)`,
          note: geom.facing === 1 ? 'De cara a la columna' : 'De espaldas a la columna',
        },
        { label: 'Accesorio', value: geom.attachment === 'barra' ? 'Barra recta' : 'Cuerda', note: geom.palm === 'supino' ? 'Agarre supino' : geom.palm === 'prono' ? 'Agarre prono' : 'Agarre neutro' },
        { label: 'Distancia', value: `Tobillos a ${cm(Math.abs(geom.ankleZ))} cm de la columna`, note: 'Pies a la anchura de las caderas, rodillas algo flexionadas' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
