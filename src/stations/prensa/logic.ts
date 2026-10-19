import { Vector3 } from 'three';
import type { Anthropometry, Segments } from '../../engine/anthropometry';
import {
  NEUTRAL_AXIAL,
  SIDES,
  dorsiflexion,
  hipFlexion,
  sideSign,
  solveBody,
  type FootTarget,
  type HandTarget,
  type Side,
} from '../../engine/body';
import { twoBoneIK } from '../../engine/ik';
import { describeLoad, platesPerSide, type LoadSpec } from '../../engine/load';
import { DEG, Frame, RAD, angleDeg, clamp, lerp, qAxis } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';

export interface PrensaMachine {
  hjc: Vector3;
  railDir: Vector3;
  platformUp: Vector3;
  platformCenter: Vector3;
  sled: number;
  sledTop: number;
  sledBottom: number;
  backrestDeg: number;
  pelvisRef: Frame;
  platesPerSide: number[];
  feetHeel: Record<Side, Vector3>;
}

/** Ángulo del carril respecto al suelo. */
const RAIL_DEG = 45;
/** Respaldo respecto a la horizontal. */
export const BACKREST_DEG = 25;
/** Distancia (m) a la que la línea del carril pasa por debajo de las caderas: la máquina no escala con el usuario. */
const RAIL_OFFSET = 0.0875;
const HIP_POS = new Vector3(0, 0.55, 0);

const RAIL = new Vector3(0, Math.sin(RAIL_DEG * DEG), Math.cos(RAIL_DEG * DEG));
const PLATFORM_UP = new Vector3(0, Math.cos(RAIL_DEG * DEG), -Math.sin(RAIL_DEG * DEG));
const X = new Vector3(1, 0, 0);

interface FootGeom {
  /** Altura del talón sobre la plataforma (m, a lo largo de su eje vertical) respecto a la línea del carril. */
  heel: number;
  /** Separación lateral de cada talón respecto al centro, fracción de talla (los pies van a la anchura de caderas). */
  halfWidthH: number;
  toeOutDeg: number;
  /** Flexión de rodilla objetivo abajo (si caderas y tobillos lo permiten). */
  targetKnee: number;
}

const FEET: Record<string, FootGeom> = {
  medios: { heel: 0.05, halfWidthH: 0.058, toeOutDeg: 12, targetKnee: 90 },
  altos: { heel: 0.2, halfWidthH: 0.058, toeOutDeg: 12, targetKnee: 85 },
  bajos: { heel: -0.08, halfWidthH: 0.058, toeOutDeg: 10, targetKnee: 95 },
  anchos: { heel: 0.1, halfWidthH: 0.15, toeOutDeg: 30, targetKnee: 90 },
};

export const PRENSA_LOAD: LoadSpec = {
  kind: 'discos',
  baseKg: 40,
  base: 'carro',
  maxPlatesKgPerSide: 120,
  effectiveFactor: Math.sin(RAIL_DEG * DEG),
  label: 'Carro + discos',
};

export function pelvisRefFrame(): Frame {
  return new Frame(HIP_POS.clone(), qAxis(X, -(90 - BACKREST_DEG)));
}

function toeDirFor(side: Side, toeOutDeg: number): Vector3 {
  const s = sideSign(side);
  return PLATFORM_UP.clone()
    .multiplyScalar(Math.cos(toeOutDeg * DEG))
    .add(X.clone().multiplyScalar(s * Math.sin(toeOutDeg * DEG)))
    .normalize();
}

function platformCenterAt(_seg: Segments, sled: number): Vector3 {
  return HIP_POS.clone()
    .add(RAIL.clone().multiplyScalar(sled))
    .sub(PLATFORM_UP.clone().multiplyScalar(RAIL_OFFSET));
}

function footOnPlatform(seg: Segments, geom: FootGeom, side: Side, sled: number): FootTarget {
  const s = sideSign(side);
  const center = platformCenterAt(seg, sled);
  const heel = center
    .add(PLATFORM_UP.clone().multiplyScalar(geom.heel))
    .add(X.clone().multiplyScalar(s * geom.halfWidthH * seg.H));
  return { heel, toeDir: toeDirFor(side, geom.toeOutDeg), up: RAIL.clone().negate() };
}

/** Geometría rápida de la pierna izquierda para un recorrido del carro (sin compensaciones). */
function legAt(seg: Segments, geom: FootGeom, sled: number) {
  const pelvis = pelvisRefFrame();
  const hjc = pelvis.point(seg.hipHalfWidth, 0, 0);
  const foot = footOnPlatform(seg, geom, 'L', sled);
  const ankle = foot.heel
    .clone()
    .add(foot.up.clone().multiplyScalar(seg.ankleHeight))
    .add(foot.toeDir.clone().multiplyScalar(seg.heelToAnkle));
  const ik = twoBoneIK(hjc, ankle, seg.thigh, seg.shank, foot.toeDir);
  const knee = 180 - angleDeg(hjc.clone().sub(ik.mid), ik.end.clone().sub(ik.mid));
  return {
    knee,
    hip: hipFlexion(pelvis, hjc, ik.mid),
    dorsi: dorsiflexion(ik.mid, ik.end, foot.toeDir),
    reachable: ik.reachable,
  };
}

/** Busca por bisección el recorrido del carro donde `pred` deja de cumplirse (pred monótono en s). */
function bisect(lo: number, hi: number, pred: (s: number) => boolean): number {
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (pred(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface PrensaRange {
  sTop: number;
  sBottom: number;
  kneeBottom: number;
  hipBottom: number;
  limitedBy: 'rodilla' | 'cadera' | 'tobillo';
}

export function prensaRange(seg: Segments, anthro: Anthropometry, variantId: string, errorId: string | null): PrensaRange {
  const geom = FEET[variantId] ?? FEET.medios!;
  const sMax = seg.thigh + seg.shank + 0.5;
  // Arriba: rodilla a 8° (sin bloquear) o extendida del todo si se demuestra el bloqueo.
  const topKnee = errorId === 'bloqueo' ? 1.5 : 8;
  const sTop = bisect(0, sMax, (s) => {
    const l = legAt(seg, geom, s);
    return !l.reachable || l.knee <= topKnee;
  });
  let limitedBy: PrensaRange['limitedBy'] = 'rodilla';
  let sBottom: number;
  if (errorId === 'profundidad') {
    sBottom = bisect(0, sTop, (s) => legAt(seg, geom, s).knee <= Math.min(geom.targetKnee + 32, 135));
  } else {
    const sKnee = bisect(0, sTop, (s) => legAt(seg, geom, s).knee <= geom.targetKnee);
    const sHip = bisect(0, sTop, (s) => legAt(seg, geom, s).hip <= anthro.hipFlexionMax - 3);
    const sAnkle = bisect(0, sTop, (s) => legAt(seg, geom, s).dorsi <= anthro.ankleDorsiMax - 2);
    sBottom = Math.max(sKnee, sHip, sAnkle);
    if (sBottom === sHip && sHip > sKnee) limitedBy = 'cadera';
    if (sBottom === sAnkle && sAnkle > Math.max(sKnee, sHip)) limitedBy = 'tobillo';
  }
  const lb = legAt(seg, geom, sBottom);
  return { sTop, sBottom, kneeBottom: lb.knee, hipBottom: lb.hip, limitedBy };
}

function handTargets(seg: Segments, pelvis: Frame): Record<Side, HandTarget> {
  const out = {} as Record<Side, HandTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    out[side] = {
      grip: pelvis.point(s * 0.17 * seg.H, 0.03 * seg.H, 0.05 * seg.H),
      pole: pelvis.dir(s, -0.3, -0.4).normalize(),
      palm: pelvis.dir(-s, 0, 0),
    };
  }
  return out;
}

/** Prensa de gemelo: rodillas casi extendidas y el movimiento lo hace el tobillo. */
function solveGemelo(input: StationFrameInput): StationSolution<PrensaMachine> {
  const { seg, anthro, p, errorId } = input;
  const base = FEET.medios!;
  const pelvisRef = pelvisRefFrame();
  const kneeTarget = errorId === 'bloqueo' ? 1.5 : 10;
  const sRef = bisect(0, seg.thigh + seg.shank + 0.5, (s) => {
    const l = legAt(seg, base, s);
    return !l.reachable || l.knee <= kneeTarget;
  });
  const dorsiFrom = errorId === 'rango_parcial' ? 4 : 15;
  const dorsiTo = errorId === 'rango_parcial' ? -8 : -25;
  const feet = {} as Record<Side, FootTarget>;
  let ballS = 0;
  for (const side of SIDES) {
    const ref = footOnPlatform(seg, base, side, sRef);
    const ankle = ref.heel
      .clone()
      .add(ref.up.clone().multiplyScalar(seg.ankleHeight))
      .add(ref.toeDir.clone().multiplyScalar(seg.heelToAnkle));
    const hjc = pelvisRef.point(sideSign(side) * seg.hipHalfWidth, 0, 0);
    const knee = twoBoneIK(hjc, ankle, seg.thigh, seg.shank, ref.toeDir).mid;
    const dorsi0 = dorsiflexion(knee, ankle, ref.toeDir);
    const target = lerp(dorsiFrom, dorsiTo, p);
    const axis = ref.up.clone().cross(ref.toeDir).normalize();
    const q = qAxis(axis, dorsi0 - target);
    const toeDir = ref.toeDir.clone().applyQuaternion(q);
    const up = ref.up.clone().applyQuaternion(q);
    const heel = ankle
      .clone()
      .sub(up.clone().multiplyScalar(seg.ankleHeight))
      .sub(toeDir.clone().multiplyScalar(seg.heelToAnkle));
    const ball = heel.clone().add(toeDir.clone().multiplyScalar(seg.heelToBall));
    ballS = Math.max(ballS, ball.clone().sub(platformCenterAt(seg, 0)).dot(RAIL));
    feet[side] = { heel, toeDir, up, kneePole: ref.toeDir, heelLiftAllowed: false };
  }
  const body = solveBody({
    seg,
    anthro,
    pelvisRef,
    pelvisPivot: seg.s1.clone(),
    axial: { ...NEUTRAL_AXIAL, neckFlex: 8 },
    feet,
    hands: handTargets(seg, pelvisRef),
  });
  const load = describeLoad(PRENSA_LOAD, input.loadKg);
  const forces: ContactForce[] = SIDES.map((side) => ({
    limb: 'leg',
    side,
    point: body.legs[side].ball.clone(),
    force: RAIL.clone().negate().multiplyScalar(load.forceN / 2),
  }));
  const sled = ballS;
  return {
    body,
    machine: machineState(seg, sled, sled, sled, pelvisRef, input.loadKg, body),
    forces,
    setup: [
      { label: 'Respaldo', value: `${BACKREST_DEG}° respecto al suelo`, note: 'Espalda y cabeza apoyadas' },
      { label: 'Pies', value: 'Bola del pie en el borde inferior de la plataforma', note: 'Talones libres, rodillas casi extendidas (≈10°)' },
      { label: 'Recorrido', value: 'Del estiramiento (talón por debajo) a la máxima flexión plantar' },
      { label: 'Carga', value: load.detail },
    ],
  };
}

function machineState(
  _seg: Segments,
  sled: number,
  sTop: number,
  sBottom: number,
  pelvisRef: Frame,
  loadKg: number,
  body: ReturnType<typeof solveBody>,
): PrensaMachine {
  return {
    hjc: HIP_POS.clone(),
    railDir: RAIL.clone(),
    platformUp: PLATFORM_UP.clone(),
    platformCenter: platformCenterAt(_seg, sled),
    sled,
    sledTop: sTop,
    sledBottom: sBottom,
    backrestDeg: BACKREST_DEG,
    pelvisRef,
    platesPerSide: platesPerSide(loadKg / 2),
    feetHeel: { L: body.legs.L.heel.clone(), R: body.legs.R.heel.clone() },
  };
}

export const prensaLogic: StationLogic<PrensaMachine> = {
  id: 'prensa',
  forward: new Vector3(0, 0, 1),
  startAt: 'contraccion',
  load: PRENSA_LOAD,
  defaultLoadKg: 60,
  bounds: { min: [-0.7, 0, -0.95], max: [0.7, 1.9, 2.05] },
  framePoints: (m) => {
    const pts: Vector3[] = [];
    for (const x of [-0.6, 0.6]) {
      pts.push(m.platformCenter.clone().add(m.platformUp.clone().multiplyScalar(0.5)).setX(x));
      pts.push(m.platformCenter.clone().add(m.platformUp.clone().multiplyScalar(-0.3)).setX(x));
      pts.push(m.pelvisRef.point(x, 0.5, -0.15));
      pts.push(new Vector3(x, 0, m.pelvisRef.point(0, 0.5, -0.15).z));
      pts.push(new Vector3(x, 0, m.platformCenter.z + 0.4));
    }
    return pts;
  },
  solve(input: StationFrameInput): StationSolution<PrensaMachine> {
    if (input.variantId === 'gemelo') return solveGemelo(input);
    const { seg, anthro, p, errorId } = input;
    const geom = FEET[input.variantId] ?? FEET.medios!;
    const range = prensaRange(seg, anthro, input.variantId, errorId);
    const sled = lerp(range.sBottom, range.sTop, p);
    const pelvisRef = pelvisRefFrame();

    const feet = {} as Record<Side, FootTarget>;
    for (const side of SIDES) {
      const f = footOnPlatform(seg, geom, side, sled);
      if (errorId === 'valgo') {
        // Las rodillas colapsan hacia dentro al empezar el empuje desde abajo.
        const hjc = pelvisRef.point(sideSign(side) * seg.hipHalfWidth, 0, 0);
        const ankle = f.heel.clone().add(f.up.clone().multiplyScalar(seg.ankleHeight)).add(f.toeDir.clone().multiplyScalar(seg.heelToAnkle));
        const axis = ankle.sub(hjc).normalize();
        const angle = 20 * clamp(1 - p / 0.65, 0, 1);
        f.kneePole = f.toeDir.clone().applyQuaternion(qAxis(axis, sideSign(side) * angle));
      }
      feet[side] = f;
    }
    const forcedHeelLift = errorId === 'talones' ? 16 * clamp(1 - p / 0.55, 0, 1) : 0;

    const body = solveBody({
      seg,
      anthro,
      pelvisRef,
      pelvisPivot: seg.s1.clone(),
      axial: { ...NEUTRAL_AXIAL, neckFlex: 8 },
      feet,
      hands: handTargets(seg, pelvisRef),
      hipCompensation: true,
      forcedHeelLift,
    });

    const load = describeLoad(PRENSA_LOAD, input.loadKg);
    const forces: ContactForce[] = SIDES.map((side) => {
      const leg = body.legs[side];
      const cop = leg.heelLift > 0.5 ? leg.ball.clone() : leg.heel.clone().add(leg.toeDir.clone().multiplyScalar(0.45 * seg.footLen));
      return { limb: 'leg', side, point: cop, force: RAIL.clone().negate().multiplyScalar(load.forceN / 2) };
    });

    const heelCm = Math.round((geom.heel + 0.3) * 100);
    const feetText: Record<string, string> = {
      medios: 'Centro de la plataforma, a la anchura de caderas, puntas 10–15° hacia fuera',
      altos: 'Parte alta de la plataforma, a la anchura de caderas',
      bajos: 'Parte baja de la plataforma, a la anchura de caderas',
      anchos: 'Más anchos que los hombros, puntas ~30° hacia fuera',
    };
    const limitText =
      range.limitedBy === 'cadera'
        ? ` (limitada por tu movilidad de cadera: ${anthro.hipFlexionMax}°)`
        : range.limitedBy === 'tobillo'
          ? ` (limitada por tu flexión dorsal de tobillo: ${anthro.ankleDorsiMax}°)`
          : '';
    return {
      body,
      machine: machineState(seg, sled, range.sTop, range.sBottom, pelvisRef, input.loadKg, body),
      forces,
      setup: [
        { label: 'Respaldo', value: `${BACKREST_DEG}° respecto al suelo`, note: 'Zona lumbar y sacro apoyados en todo momento' },
        { label: 'Pies', value: feetText[input.variantId] ?? feetText.medios!, note: `Talón a ~${heelCm} cm del borde inferior` },
        {
          label: 'Profundidad recomendada',
          value: `Rodilla ≈ ${Math.round(range.kneeBottom)}°, cadera ≈ ${Math.round(range.hipBottom)}°${limitText}`,
          note: 'Coloca los topes de seguridad justo por debajo de este punto',
        },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};

export const _internals = { legAt, FEET, RAIL, RAD };
