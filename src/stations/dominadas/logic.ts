import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type HandTarget, type Side, type SolvedBody } from '../../engine/body';
import { describeLoad, type LoadSpec } from '../../engine/load';
import { Frame, lerp, qAxis, sampleKeys } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import { axialAt, hangingFeet, reachFor, type AxialKeys, type Keys } from '../common';

/**
 * Dominadas (peso corporal). Como en los fondos, las manos quedan fijas en la barra y es el
 * cuerpo el que se mueve: abajo cuelga con los codos casi extendidos y arriba la barbilla pasa
 * la barra con el pecho cerca de ella. Entre medias, el hombro sigue una recta entre ambas
 * posiciones. Carga: peso corporal − asistencia (rodillera con contrapeso) o + lastre (cinturón).
 */

export type DominadasGrip = 'barra' | 'paralelas';

export interface DominadasMachine {
  barY: number;
  grip: DominadasGrip;
  grips: Record<Side, Vector3>;
  assistKg: number;
  ballastKg: number;
  kneePad: Vector3 | null;
  belt: Vector3 | null;
  stackLift: number;
}

interface VariantGeom {
  grip: DominadasGrip;
  /** Media separación de manos: fracción de la talla en la barra recta; fija (m) en las asas paralelas. */
  halfGrip: (H: number) => number;
  palm: 'prono' | 'supino' | 'neutro';
  /** Inclinación del tronco (+ adelante): casi vertical colgado, algo atrás arriba. */
  lean: Keys;
  /** Polo del codo (sistema del tórax) colgado y arriba. */
  poleHang: readonly [number, number, number];
  poleTop: readonly [number, number, number];
}

const GEOM: Record<string, VariantGeom> = {
  'prona-ancha': {
    grip: 'barra',
    halfGrip: (H) => 0.19 * H,
    palm: 'prono',
    lean: [
      { p: 0, v: -2 },
      { p: 1, v: -14 },
    ],
    poleHang: [1, 0, -0.15],
    poleTop: [1, -0.25, -0.35],
  },
  supina: {
    grip: 'barra',
    halfGrip: (H) => 0.105 * H,
    palm: 'supino',
    lean: [
      { p: 0, v: -2 },
      { p: 1, v: -9 },
    ],
    poleHang: [0.3, 0, 1],
    poleTop: [0.35, -0.6, 0.75],
  },
  neutra: {
    grip: 'paralelas',
    halfGrip: () => DOMINADAS_PARALLEL_HALF,
    palm: 'neutro',
    lean: [
      { p: 0, v: -2 },
      { p: 1, v: -11 },
    ],
    poleHang: [0.55, 0, 0.8],
    poleTop: [0.55, -0.5, 0.5],
  },
};

export const DOMINADAS_BAR_Y = 2.3;
/** Asas paralelas: separación fija y algo por delante de la barra recta. */
export const DOMINADAS_PARALLEL_HALF = 0.24;
export const DOMINADAS_PARALLEL_Z = 0.16;
/** Flexión de codo colgado (casi extendido, sin bloquear). */
const HANG_FLEX = 8;
/** Arriba: escotadura del esternón por debajo de la barra y por detrás de ella (barbilla por encima). */
const TOP_NOTCH_BELOW = 0.04;
const TOP_NOTCH_BEHIND = 0.07;

export const DOMINADAS_LOAD: LoadSpec = { kind: 'corporal', maxAssistKg: 50, maxBallastKg: 40, stepKg: 5, label: 'Peso corporal ± asistencia o lastre' };

const AXIAL_KEYS: AxialKeys = {
  // Colgado activo: escápulas algo elevadas (la elevación es parte del colgado) pero no «sueltas».
  scapElev: [
    { p: 0, v: 9 },
    { p: 0.2, v: 0 },
    { p: 1, v: -8 },
  ],
  scapProt: [
    { p: 0, v: 4 },
    { p: 1, v: -12 },
  ],
  lumbarFlex: [
    { p: 0, v: 0 },
    { p: 1, v: -6 },
  ],
  thoracicFlex: [
    { p: 0, v: 0 },
    { p: 1, v: -8 },
  ],
  neckFlex: [
    { p: 0, v: 2 },
    { p: 1, v: -4 },
  ],
  wristExt: [{ p: 0, v: 0 }],
};

function axialFor(p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'encogimiento') {
    over.scapElev = lerp(28, 14, p);
    over.scapProt = lerp(8, 2, p);
  } else if (errorId === 'cuello') {
    over.neckFlex = lerp(-6, -34, p);
  } else if (errorId === 'kipping') {
    over.lumbarFlex = sampleKeys(
      [
        { p: 0, v: 0 },
        { p: 0.3, v: -14 },
        { p: 0.6, v: 6 },
        { p: 1, v: -6 },
      ],
      p,
    );
  }
  return axialAt(AXIAL_KEYS, p, over);
}

function leanFor(geom: VariantGeom, p: number, errorId: string | null): number {
  if (errorId === 'kipping') {
    // Balanceo: el tronco se echa atrás con las piernas adelante y después se lanza hacia la barra.
    return sampleKeys(
      [
        { p: 0, v: -2 },
        { p: 0.3, v: -34 },
        { p: 0.6, v: 10 },
        { p: 1, v: geom.lean[1]!.v },
      ],
      p,
    );
  }
  return sampleKeys(geom.lean, p);
}

/** Cadera durante el kipping: rodillas al pecho y después extensión brusca. */
function hipFor(p: number, errorId: string | null): number {
  if (errorId !== 'kipping') return 10;
  return sampleKeys(
    [
      { p: 0, v: 10 },
      { p: 0.3, v: 62 },
      { p: 0.6, v: -14 },
      { p: 1, v: 18 },
    ],
    p,
  );
}

/** Escotadura del esternón (por delante de la columna torácica alta). */
function sternalNotch(body: SolvedBody): Vector3 {
  const { seg } = body;
  return body.thorax.point(0, 0.93 * seg.thoracic, 0.085 * seg.H * Math.pow(seg.build, 0.8));
}

const ghMid = (body: SolvedBody) => body.arms.L.gh.clone().add(body.arms.R.gh).multiplyScalar(0.5);

export const dominadasLogic: StationLogic<DominadasMachine> = {
  id: 'dominadas',
  forward: new Vector3(0, 0, 1),
  startAt: 'estiramiento',
  load: DOMINADAS_LOAD,
  defaultLoadKg: 0,
  bounds: { min: [-0.8, 0, -0.75], max: [0.8, 2.55, 0.85] },
  framePoints: (m) => [
    new Vector3(0.7, 0, -0.6),
    new Vector3(-0.7, 0, -0.6),
    new Vector3(0.7, 0, 0.8),
    new Vector3(-0.7, 0, 0.8),
    new Vector3(0.7, m.barY + 0.2, 0.6),
    new Vector3(-0.7, m.barY + 0.2, 0.6),
    new Vector3(0.7, m.barY, 0),
    new Vector3(-0.7, m.barY, 0),
  ],
  solve(input: StationFrameInput): StationSolution<DominadasMachine> {
    const { seg, anthro, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM['prona-ancha']!;
    // Recorrido parcial: ni se extienden los codos abajo ni pasa la barbilla arriba.
    const p = errorId === 'rango_parcial' ? 0.3 + 0.4 * input.p : input.p;
    const axial = axialFor(p, errorId);
    const lean = leanFor(geom, p, errorId);
    const hip = hipFor(p, errorId);

    const halfGrip = geom.halfGrip(seg.H);
    const gripZ = geom.grip === 'paralelas' ? DOMINADAS_PARALLEL_Z : 0;
    const grips = {} as Record<Side, Vector3>;
    for (const side of SIDES) grips[side] = new Vector3(sideSign(side) * halfGrip, DOMINADAS_BAR_Y, gripZ);

    /** Cuerpo sin manos con la pelvis en el origen, para medir dónde quedan hombros y pecho. */
    const probeAt = (ax: AxialParams, leanDeg: number, hipDeg: number) => {
      const q = qAxis(new Vector3(1, 0, 0), leanDeg - ax.lumbarFlex - ax.thoracicFlex);
      const probe = new Frame(new Vector3(), q);
      return solveBody({ seg, anthro, pelvisRef: probe, pelvisPivot: new Vector3(), axial: ax, feet: hangingFeet(seg, probe, { hipDeg, kneeDeg: 70, plantarDeg: 30 }) });
    };

    // Colgado: hombros bajo las manos a la distancia del brazo casi extendido.
    const hangBody = probeAt(axialFor(0, null), sampleKeys(geom.lean, 0), 10);
    const hangHalf = (Math.abs(hangBody.arms.L.gh.x) + Math.abs(hangBody.arms.R.gh.x)) / 2;
    const reach = reachFor(seg, HANG_FLEX, 0);
    const dx = halfGrip - hangHalf;
    const dz = -0.03;
    const hangTarget = new Vector3(0, DOMINADAS_BAR_Y - Math.sqrt(Math.max(0.01, reach * reach - dx * dx - dz * dz)), gripZ + dz);

    // Arriba: el esternón alto justo por debajo y por detrás de la barra.
    const topBody = probeAt(axialFor(1, null), sampleKeys(geom.lean, 1), 10);
    const notchTarget = new Vector3(0, DOMINADAS_BAR_Y - TOP_NOTCH_BELOW, gripZ - TOP_NOTCH_BEHIND);
    const topTarget = notchTarget.clone().add(ghMid(topBody).sub(sternalNotch(topBody)));

    // Hombros en línea recta entre ambas posiciones (con un leve arco hacia atrás a mitad).
    const target = hangTarget.clone().lerp(topTarget, p);
    target.z -= 0.03 * Math.sin(Math.PI * p);

    const pre = probeAt(axial, lean, hip);
    const pelvis = new Frame(target.clone().sub(ghMid(pre)).setX(0), pre.pelvis.q.clone());
    const feet = hangingFeet(seg, pelvis, { hipDeg: hip, kneeDeg: 70, plantarDeg: 30 });

    const hands = {} as Record<Side, HandTarget>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const ph = geom.poleHang;
      const pt = geom.poleTop;
      const pole = pre.thorax.dir(s * lerp(ph[0], pt[0], p), lerp(ph[1], pt[1], p), lerp(ph[2], pt[2], p));
      const palm = geom.palm === 'prono' ? new Vector3(0, 0, 1) : geom.palm === 'supino' ? new Vector3(0, 0, -1) : new Vector3(-s, 0, 0);
      hands[side] = { grip: grips[side].clone(), pole: pole.normalize(), palm };
    }
    const body = solveBody({ seg, anthro, pelvisRef: pelvis, pelvisPivot: new Vector3(), axial, feet, hands });

    const load = describeLoad(DOMINADAS_LOAD, input.loadKg, anthro.massKg);
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: grips[side].clone(),
      force: new Vector3(0, load.forceN / 2, 0),
    }));
    const assistKg = Math.max(0, -input.loadKg);
    const ballastKg = Math.max(0, input.loadKg);
    const kneeMid = body.legs.L.knee.clone().add(body.legs.R.knee).multiplyScalar(0.5);
    const hangPelvisY = hangTarget.y - ghMid(hangBody).y;
    const gripCm = Math.round(2 * halfGrip * 100);
    return {
      body,
      machine: {
        barY: DOMINADAS_BAR_Y,
        grip: geom.grip,
        grips,
        assistKg,
        ballastKg,
        kneePad: assistKg > 0 ? kneeMid.clone().add(new Vector3(0, -seg.r.shank - 0.04, -0.02)) : null,
        belt: ballastKg > 0 ? body.pelvis.point(0, -0.02 * seg.H, -0.02 * seg.H) : null,
        stackLift: assistKg > 0 ? Math.max(0, body.pelvis.origin.y - hangPelvisY) * 0.5 : 0,
      },
      forces,
      setup: [
        {
          label: 'Agarre',
          value:
            geom.palm === 'prono'
              ? `Prono, ${gripCm} cm entre manos (≈1,5× anchura de hombros)`
              : geom.palm === 'supino'
                ? `Supino, ${gripCm} cm entre manos (anchura de hombros)`
                : `Neutro en las asas paralelas (${gripCm} cm)`,
          note: 'Pulgar alrededor de la barra; muñecas rectas',
        },
        {
          label: 'Modo',
          value: assistKg > 0 ? `Asistida: −${assistKg} kg en la rodillera` : ballastKg > 0 ? `Lastrada: +${ballastKg} kg en el cinturón` : 'Libre (peso corporal)',
          note: 'Elige la carga que te permita 5–10 repeticiones completas',
        },
        { label: 'Barra', value: `${Math.round(DOMINADAS_BAR_Y * 100)} cm del suelo`, note: 'Colgado con los brazos extendidos y las rodillas flexionadas, sin tocar el suelo' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
