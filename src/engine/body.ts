import { Vector3 } from 'three';
import type { Anthropometry, Segments } from './anthropometry';
import { twoBoneIK } from './ik';
import { DEG, Frame, RAD, angleDeg, clamp, qAxis } from './math';

export type Side = 'L' | 'R';
export const SIDES: readonly Side[] = ['L', 'R'];
/** +1 izquierda (+X), −1 derecha. */
export const sideSign = (s: Side) => (s === 'L' ? 1 : -1);

const AX_X = new Vector3(1, 0, 0);
const AX_Y = new Vector3(0, 1, 0);
const AX_Z = new Vector3(0, 0, 1);

/** Parámetros axiales (tronco, escápula, cuello, muñeca) en grados. */
export interface AxialParams {
  /** + anteversión, − retroversión (respecto a la referencia de la estación). */
  pelvisTilt: number;
  /** + flexión, − extensión. */
  lumbarFlex: number;
  thoracicFlex: number;
  /** + flexión (barbilla al pecho). */
  neckFlex: number;
  /** + elevación (encoger), − depresión. */
  scapElev: number;
  /** + protracción, − retracción. */
  scapProt: number;
  /** Protracción de un solo lado (ejercicios unilaterales); si falta, `scapProt`. */
  scapProtSide?: Partial<Record<Side, number>>;
  /** + extensión de muñeca. */
  wristExt: number;
}

export const NEUTRAL_AXIAL: AxialParams = {
  pelvisTilt: 0,
  lumbarFlex: 0,
  thoracicFlex: 0,
  neckFlex: 0,
  scapElev: 0,
  scapProt: 0,
  wristExt: 0,
};

export interface HandTarget {
  /** Centro del agarre (punto de contacto con el maneral). */
  grip: Vector3;
  /** Dirección hacia la que debe apuntar el codo. */
  pole: Vector3;
  /** Normal de la palma (hacia donde mira la palma). */
  palm: Vector3;
}

export interface FootTarget {
  /** Punto del talón sobre la superficie de apoyo. */
  heel: Vector3;
  /** Dirección talón → dedos sobre la superficie. */
  toeDir: Vector3;
  /** Normal de la superficie (hacia el pie). */
  up: Vector3;
  /** Dirección hacia la que apunta la rodilla (por defecto, la de los dedos). */
  kneePole?: Vector3;
  /** Si es false, el talón no se despega aunque falte flexión dorsal. */
  heelLiftAllowed?: boolean;
}

export interface BodyInput {
  seg: Segments;
  anthro: Anthropometry;
  /** Pelvis en inclinación neutra (origen = punto medio entre centros de cadera). */
  pelvisRef: Frame;
  /** Punto local de la pelvis que permanece fijo al bascular (S1 con respaldo, centro de caderas sentado). */
  pelvisPivot: Vector3;
  axial: AxialParams;
  hands?: Record<Side, HandTarget>;
  feet: Record<Side, FootTarget>;
  /** Si la flexión de cadera supera el máximo funcional, la pelvis retroversa y la lumbar flexiona. */
  hipCompensation?: boolean;
  /** Despegue de talón forzado (error), en grados. */
  forcedHeelLift?: number;
}

export interface LimbSolution {
  root: Vector3;
  mid: Vector3;
  end: Vector3;
  reachable: boolean;
  shortfall: number;
}

export interface ArmSolution extends LimbSolution {
  sc: Vector3;
  gh: Vector3;
  elbow: Vector3;
  wrist: Vector3;
  grip: Vector3;
  palm: Vector3;
  /** Dirección hacia la que apunta el codo (polo de la IK). */
  pole: Vector3;
  /** true si la mano sujeta un maneral (dedos cerrados). */
  gripping: boolean;
}

export interface LegSolution extends LimbSolution {
  hjc: Vector3;
  knee: Vector3;
  ankle: Vector3;
  heel: Vector3;
  ball: Vector3;
  toe: Vector3;
  toeDir: Vector3;
  footUp: Vector3;
  heelLift: number;
  /** Dirección hacia la que apunta la rodilla (polo de la IK). */
  pole: Vector3;
}

export interface SolvedBody {
  seg: Segments;
  axial: AxialParams;
  /** Compensación pélvica aplicada (grados de retroversión añadidos). */
  pelvicCompensation: number;
  pelvisRef: Frame;
  pelvis: Frame;
  lumbar: Frame;
  thorax: Frame;
  neck: Frame;
  s1: Vector3;
  l1: Vector3;
  c7: Vector3;
  head: Vector3;
  arms: Record<Side, ArmSolution>;
  legs: Record<Side, LegSolution>;
}

export const scapProtOf = (axial: AxialParams, side: Side) => axial.scapProtSide?.[side] ?? axial.scapProt;

function solveArm(
  seg: Segments,
  thorax: Frame,
  axial: AxialParams,
  side: Side,
  target: HandTarget | undefined,
): ArmSolution {
  const s = sideSign(side);
  const sc = thorax.point(s * seg.scLeft.x, seg.thoracic + seg.scLeft.y, seg.scLeft.z);
  const qG = qAxis(AX_Y, -s * scapProtOf(axial, side)).multiply(qAxis(AX_Z, s * axial.scapElev));
  const clav = new Vector3(s * seg.clavicleLeft.x, seg.clavicleLeft.y, seg.clavicleLeft.z)
    .applyQuaternion(qG)
    .applyQuaternion(thorax.q);
  const gh = sc.clone().add(clav);

  if (!target) {
    // Brazos relajados junto al tronco.
    const down = thorax.dir(0, -1, 0);
    const elbow = gh.clone().add(down.clone().multiplyScalar(seg.upperArm));
    const fore = thorax.dir(0, -0.85, 0.5).normalize();
    const wrist = elbow.clone().add(fore.clone().multiplyScalar(seg.forearm));
    const grip = wrist.clone().add(fore.clone().multiplyScalar(seg.hand));
    return {
      sc,
      gh,
      elbow,
      wrist,
      grip,
      palm: thorax.dir(-s, 0, 0),
      pole: thorax.dir(0, 0, -1),
      gripping: false,
      root: gh,
      mid: elbow,
      end: grip,
      reachable: true,
      shortfall: 0,
    };
  }

  // Antebrazo + mano como un único hueso efectivo, con el ángulo de muñeca.
  const th = axial.wristExt * DEG;
  const fa = seg.forearm;
  const h = seg.hand;
  const L2 = Math.sqrt(fa * fa + h * h + 2 * fa * h * Math.cos(th));
  const alpha = Math.atan2(h * Math.sin(th), fa + h * Math.cos(th));
  const ik = twoBoneIK(gh, target.grip, seg.upperArm, L2, target.pole);
  const elbow = ik.mid;
  const grip = ik.end;
  const c = grip.clone().sub(elbow).normalize();
  let palmPerp = target.palm.clone().sub(c.clone().multiplyScalar(target.palm.dot(c)));
  if (palmPerp.lengthSq() < 1e-10) palmPerp = thorax.dir(0, 0, 1);
  palmPerp.normalize();
  // La extensión lleva la mano hacia el dorso; el antebrazo queda girado hacia la palma.
  const f = c
    .clone()
    .multiplyScalar(Math.cos(alpha))
    .add(palmPerp.clone().multiplyScalar(Math.sin(alpha)))
    .normalize();
  const wrist = elbow.clone().add(f.multiplyScalar(fa));
  return {
    sc,
    gh,
    elbow,
    wrist,
    grip,
    palm: target.palm.clone().normalize(),
    pole: target.pole.clone().normalize(),
    gripping: true,
    root: gh,
    mid: elbow,
    end: grip,
    reachable: ik.reachable,
    shortfall: ik.shortfall,
  };
}

function footPoints(seg: Segments, heel: Vector3, toeDir: Vector3, up: Vector3) {
  const ankle = heel
    .clone()
    .add(up.clone().multiplyScalar(seg.ankleHeight))
    .add(toeDir.clone().multiplyScalar(seg.heelToAnkle));
  const ball = heel.clone().add(toeDir.clone().multiplyScalar(seg.heelToBall));
  const toe = heel.clone().add(toeDir.clone().multiplyScalar(seg.footLen));
  return { ankle, ball, toe };
}

/** Flexión dorsal: 0 con la tibia perpendicular al pie; + cuando la rodilla avanza sobre los dedos. */
export function dorsiflexion(knee: Vector3, ankle: Vector3, toeDir: Vector3): number {
  return 90 - angleDeg(knee.clone().sub(ankle), toeDir);
}

function solveLegWithFoot(
  seg: Segments,
  hjc: Vector3,
  foot: FootTarget,
  liftDeg: number,
): LegSolution {
  const toeDir0 = foot.toeDir.clone().normalize();
  const up0 = foot.up.clone().normalize();
  let heel = foot.heel.clone();
  let toeDir = toeDir0.clone();
  let up = up0.clone();
  if (liftDeg > 0) {
    const ball0 = foot.heel.clone().add(toeDir0.clone().multiplyScalar(seg.heelToBall));
    const axis = up0.clone().cross(toeDir0).normalize();
    const q = qAxis(axis, liftDeg);
    heel = ball0.clone().add(foot.heel.clone().sub(ball0).applyQuaternion(q));
    toeDir = toeDir0.clone().applyQuaternion(q);
    up = up0.clone().applyQuaternion(q);
  }
  const { ankle, ball, toe } = footPoints(seg, heel, toeDir, up);
  const pole = (foot.kneePole ?? toeDir0).clone();
  const ik = twoBoneIK(hjc, ankle, seg.thigh, seg.shank, pole);
  return {
    hjc,
    knee: ik.mid,
    ankle: ik.end,
    heel,
    ball,
    toe,
    toeDir,
    footUp: up,
    heelLift: liftDeg,
    pole: pole.normalize(),
    root: hjc,
    mid: ik.mid,
    end: ik.end,
    reachable: ik.reachable,
    shortfall: ik.shortfall,
  };
}

function solveLeg(
  input: BodyInput,
  pelvis: Frame,
  side: Side,
): LegSolution {
  const { seg } = input;
  const s = sideSign(side);
  const hjc = pelvis.point(s * seg.hipHalfWidth, 0, 0);
  const foot = input.feet[side];
  if (input.forcedHeelLift && input.forcedHeelLift > 0) {
    return solveLegWithFoot(seg, hjc, foot, input.forcedHeelLift);
  }
  const flat = solveLegWithFoot(seg, hjc, foot, 0);
  const limit = input.anthro.ankleDorsiMax;
  if (foot.heelLiftAllowed === false) return flat;
  if (dorsiflexion(flat.knee, flat.ankle, flat.toeDir) <= limit) return flat;
  // Bisección: ángulo de despegue de talón que deja la flexión dorsal en el límite.
  let lo = 0;
  let hi = 45;
  let best = flat;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const sol = solveLegWithFoot(seg, hjc, foot, mid);
    best = sol;
    if (dorsiflexion(sol.knee, sol.ankle, sol.toeDir) > limit) lo = mid;
    else hi = mid;
  }
  return best;
}

/** Flexión de cadera (plano sagital de la pelvis): 0 = muslo colgando, 90 = muslo perpendicular al tronco. */
export function hipFlexion(pelvis: Frame, hjc: Vector3, knee: Vector3): number {
  const t = pelvis.toLocalDir(knee.clone().sub(hjc).normalize());
  const deg = Math.atan2(t.z, -t.y) * RAD;
  return deg < -90 ? deg + 360 : deg;
}

function solveOnce(input: BodyInput, axial: AxialParams, compensation: number): SolvedBody {
  const { seg } = input;
  const pelvis = input.pelvisRef.rotatedAbout(input.pelvisPivot, qAxis(AX_X, axial.pelvisTilt));
  const s1 = pelvis.pointV(seg.s1);
  const lumbar = new Frame(s1, pelvis.q.clone().multiply(qAxis(AX_X, axial.lumbarFlex)));
  const l1 = lumbar.point(0, seg.lumbar, 0);
  const thorax = new Frame(l1, lumbar.q.clone().multiply(qAxis(AX_X, axial.thoracicFlex)));
  const c7 = thorax.point(0, seg.thoracic, 0);
  const neck = new Frame(c7, thorax.q.clone().multiply(qAxis(AX_X, axial.neckFlex)));
  const head = neck.point(0, seg.neck + seg.headAboveNeck, 0.012 * seg.H);
  const arms = {
    L: solveArm(seg, thorax, axial, 'L', input.hands?.L),
    R: solveArm(seg, thorax, axial, 'R', input.hands?.R),
  };
  const legs = { L: solveLeg(input, pelvis, 'L'), R: solveLeg(input, pelvis, 'R') };
  return {
    seg,
    axial,
    pelvicCompensation: compensation,
    pelvisRef: input.pelvisRef,
    pelvis,
    lumbar,
    thorax,
    neck,
    s1,
    l1,
    c7,
    head,
    arms,
    legs,
  };
}

/** Resuelve el cuerpo completo: cadena axial (FK), brazos y piernas (IK) y compensaciones. */
export function solveBody(input: BodyInput): SolvedBody {
  let axial = { ...input.axial };
  let comp = 0;
  let body = solveOnce(input, axial, comp);
  if (input.hipCompensation) {
    for (let i = 0; i < 6; i++) {
      const hf = Math.max(
        hipFlexion(body.pelvis, body.legs.L.hjc, body.legs.L.knee),
        hipFlexion(body.pelvis, body.legs.R.hjc, body.legs.R.knee),
      );
      const excess = hf - input.anthro.hipFlexionMax;
      if (excess <= 0.05) break;
      const step = clamp(excess, 0, 40);
      comp += step;
      axial = { ...axial, pelvisTilt: axial.pelvisTilt - step, lumbarFlex: axial.lumbarFlex + step };
      body = solveOnce(input, axial, comp);
    }
  }
  return body;
}
