import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import type { Segments } from '../engine/anthropometry';
import { scapProtOf, sideSign, SIDES, type Side, type SolvedBody } from '../engine/body';
import { qAxis, signedAngleAround } from '../engine/math';

/**
 * Rig del modelo anatómico: traduce la postura que resuelve el motor (marcos de pelvis,
 * columna y cuello, centros articulares e IK de brazos y piernas) a una matriz por hueso
 * para el skinning de la malla de Z-Anatomy.
 *
 * Cada hueso aplica M(x) = p + R·S·(x − a): `a` es su origen en el modelo en reposo
 * (posición anatómica), `p` el origen en la postura actual, `R` la rotación reposo → postura
 * y `S` una escala simétrica (longitud del segmento del usuario frente a la del modelo y
 * perímetro según talla y masa). Los huesos auxiliares de articulación reparten el giro a
 * medias para que músculos y piel no pierdan volumen al flexionar.
 */

export type Landmarks = Readonly<Record<string, readonly number[]>>;

export interface BoneXf {
  R: Quaternion;
  S: Matrix3;
  a: Vector3;
  p: Vector3;
}

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const ANTERIOR = Z;

const SIDED = ['girdle', 'humerus', 'fa0', 'fa1', 'fa2', 'fa3', 'hand', 'i1', 'i2', 'i3', 'm1', 'm2', 'm3', 'r1', 'r2', 'r3', 'p1', 'p2', 'p3', 't1', 't2', 'thigh', 'shank', 'foot'] as const;
const FINGERS = ['i', 'm', 'r', 'p'] as const;

/** Curvatura de los dedos (grados por falange): mano cerrada sobre un maneral o relajada. */
const CURL_GRIP = [62, 78, 48] as const;
const CURL_RELAXED = [14, 20, 10] as const;
const THUMB_GRIP = [28, 36] as const;
const THUMB_RELAXED = [6, 10] as const;

function lm(L: Landmarks, key: string, side: Side): Vector3 {
  const v = L[key];
  if (!v) throw new Error(`Falta el punto anatómico «${key}»`);
  return new Vector3(sideSign(side) * v[0]!, v[1]!, v[2]!);
}

function orth(v: Vector3, axis: Vector3, fallback: Vector3): Vector3 {
  const out = v.clone().sub(axis.clone().multiplyScalar(v.dot(axis)));
  if (out.lengthSq() < 1e-8) return orth(fallback, axis, axis.clone().cross(X).lengthSq() > 1e-6 ? X : Z);
  return out.normalize();
}

/** Base ortonormal con Y = `y` y Z lo más cerca posible de `z`. */
function basisQ(y: Vector3, z: Vector3): Quaternion {
  const yy = y.clone().normalize();
  const zz = orth(z, yy, ANTERIOR);
  const xx = yy.clone().cross(zz).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xx, yy, zz));
}

/** Base ortonormal con Y = `y` y X lo más cerca posible de `x`. */
function basisQx(y: Vector3, x: Vector3): Quaternion {
  const yy = y.clone().normalize();
  const xx = orth(x, yy, X);
  const zz = xx.clone().cross(yy).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xx, yy, zz));
}

const rel = (pose: Quaternion, rest: Quaternion) => pose.clone().multiply(rest.clone().invert());

/** Escala `l` a lo largo de `u` y `g` en perpendicular. */
function axisScale(u: Vector3, l: number, g: number): Matrix3 {
  const n = u.clone().normalize();
  const k = l - g;
  return new Matrix3().set(
    g + k * n.x * n.x, k * n.x * n.y, k * n.x * n.z,
    k * n.y * n.x, g + k * n.y * n.y, k * n.y * n.z,
    k * n.z * n.x, k * n.z * n.y, g + k * n.z * n.z,
  );
}

/** Escala diagonal expresada en los ejes de una base (R·diag·Rᵀ). */
function frameScale(q: Quaternion, sx: number, sy: number, sz: number): Matrix3 {
  const R = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(q));
  const D = new Matrix3().set(sx, 0, 0, 0, sy, 0, 0, 0, sz);
  return R.clone().multiply(D).multiply(R.clone().transpose());
}

const diag = (sx: number, sy: number, sz: number) => new Matrix3().set(sx, 0, 0, 0, sy, 0, 0, 0, sz);

export function applyXf(b: BoneXf, x: Vector3): Vector3 {
  return x.clone().sub(b.a).applyMatrix3(b.S).applyQuaternion(b.R).add(b.p);
}

function xf(R: Quaternion, S: Matrix3, a: Vector3, p: Vector3): BoneXf {
  return { R, S, a: a.clone(), p: p.clone() };
}

/** Rotación mínima que lleva la dirección `from` a `to`. */
function minRot(from: Vector3, to: Vector3) {
  return new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
}

/** Gira `b` alrededor de un eje que pasa por el punto `c` (coordenadas de reposo) antes de aplicarlo. */
function composeRot(b: BoneXf, c: Vector3, axis: Vector3, deg: number): BoneXf {
  const q = qAxis(axis, deg);
  // M'(x) = M(c + q·(x − c)) = p + R·S·(c − a) + R·S·q·(x − c)
  const S = b.S.clone().multiply(new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(q)));
  // R·S·q no es R'·S' simétrico; se guarda la parte lineal completa en S con R = R.
  return { R: b.R.clone(), S, a: c.clone(), p: applyXf(b, c) };
}

function helper(A: BoneXf, B: BoneXf, c: Vector3): BoneXf {
  const R = A.R.clone().slerp(B.R, 0.5);
  const S = new Matrix3();
  for (let i = 0; i < 9; i++) S.elements[i] = (A.S.elements[i]! + B.S.elements[i]!) / 2;
  const p = applyXf(A, c).add(applyXf(B, c)).multiplyScalar(0.5);
  return xf(R, S, c, p);
}

function pronation(prox: Quaternion, axis: Vector3, palm: Vector3, s: number): number {
  const z0 = Z.clone().applyQuaternion(prox);
  let P = s * signedAngleAround(z0, palm, axis);
  if (P < -90) P += 360;
  return P;
}

export interface RigContext {
  landmarks: Landmarks;
  bones: readonly string[];
}

/**
 * Calcula la transformación de cada hueso del rig para el cuerpo resuelto.
 * Devuelve un mapa nombre → transformación (los nombres siguen el manifiesto exportado).
 */
export function solveRig(ctx: RigContext, body: SolvedBody): Map<string, BoneXf> {
  const L = ctx.landmarks;
  const seg: Segments = body.seg;
  const out = new Map<string, BoneXf>();
  const Hm = L.top![1]!;
  const kH = seg.H / Hm;
  const kb = seg.build;
  const g = kH * Math.pow(kb, 0.6);

  // --- Tronco: alineación global modelo → postura neutra del motor y marcos de la columna.
  const hjcL = lm(L, 'hjc', 'L');
  const hipMid = new Vector3(0, hjcL.y, hjcL.z);
  const ghL = lm(L, 'gh', 'L');
  const ghNeutral = seg.s1.y + seg.lumbar + seg.thoracic + seg.scLeft.y + seg.clavicleLeft.y;
  const sy = ghNeutral / (ghL.y - hipMid.y);
  const S_trunk = diag(kH * Math.pow(kb, 0.5), sy, kH * Math.pow(kb, 0.8));
  const inv = (v: Vector3) => new Vector3(v.x / S_trunk.elements[0]!, v.y / S_trunk.elements[4]!, v.z / S_trunk.elements[8]!);
  const l1N = seg.s1.clone().add(new Vector3(0, seg.lumbar, 0));
  const c7N = l1N.clone().add(new Vector3(0, seg.thoracic, 0));
  out.set('pelvis', xf(body.pelvis.q.clone(), S_trunk, hipMid, body.pelvis.origin));
  out.set('lumbar', xf(body.lumbar.q.clone(), S_trunk, hipMid.clone().add(inv(seg.s1)), body.s1));
  out.set('thorax', xf(body.thorax.q.clone(), S_trunk, hipMid.clone().add(inv(l1N)), body.l1));
  const neckA = hipMid.clone().add(inv(c7N));
  // Cabeza a la talla del usuario (sin la compresión vertical del tronco).
  const headK = kH * 1.03;
  out.set('neck', xf(body.neck.q.clone(), diag(headK, headK, headK), neckA, body.c7));
  out.set('h_s1', helper(out.get('pelvis')!, out.get('lumbar')!, out.get('lumbar')!.a));
  out.set('h_l1', helper(out.get('lumbar')!, out.get('thorax')!, out.get('thorax')!.a));
  out.set('h_c7', helper(out.get('thorax')!, out.get('neck')!, neckA));
  const thorax = out.get('thorax')!;
  const pelvis = out.get('pelvis')!;

  for (const side of SIDES) {
    const s = sideSign(side);
    const arm = body.arms[side];
    const leg = body.legs[side];
    const k = (name: string) => `${name}.${side}`;
    const P = (key: string) => lm(L, key, side);

    // Cintura escapular: del esternón (según el tórax) al centro glenohumeral del motor.
    const sc = P('sc');
    const gh = P('gh');
    const qG = qAxis(Y, -s * scapProtOf(body.axial, side)).multiply(qAxis(new Vector3(0, 0, 1), s * body.axial.scapElev));
    const Rref = body.thorax.q.clone().multiply(qG);
    const scPose = applyXf(thorax, sc);
    const restDir = gh.clone().sub(sc);
    const poseDir = arm.gh.clone().sub(scPose);
    const Rg = minRot(restDir.clone().applyQuaternion(Rref), poseDir).multiply(Rref);
    out.set(k('girdle'), xf(Rg, axisScale(restDir, poseDir.length() / restDir.length(), g), sc, scPose));

    // Brazo: Y a lo largo del húmero, Z hacia la cara anterior (opuesta al polo del codo).
    const elbow = P('elbow');
    const wrist = P('wrist');
    const qHr = basisQ(elbow.clone().sub(gh), ANTERIOR);
    const qHp = basisQ(arm.elbow.clone().sub(arm.gh), arm.pole.clone().negate());
    out.set(k('humerus'), xf(rel(qHp, qHr), axisScale(elbow.clone().sub(gh), seg.upperArm / elbow.distanceTo(gh), g), gh, arm.gh));

    // Antebrazo en 4 bandas: la pronosupinación se reparte del codo a la muñeca.
    const xHr = X.clone().applyQuaternion(qHr);
    const xHp = X.clone().applyQuaternion(qHp);
    const fr = wrist.clone().sub(elbow).normalize();
    const fp = arm.wrist.clone().sub(arm.elbow).normalize();
    const qFr = basisQx(fr, xHr);
    const qFp = basisQx(fp, xHp);
    const m3 = P('m0');
    const handAxis = m3.clone().sub(wrist).normalize();
    const radial = P('i0').sub(P('p0')).normalize();
    const palmRest = handAxis.clone().cross(radial).multiplyScalar(s).normalize();
    const Pr = pronation(qFr, fr, palmRest, s);
    const Pp = pronation(qFp, fp, arm.palm, s);
    const Sfa = axisScale(fr, seg.forearm / wrist.distanceTo(elbow), g);
    for (let b = 0; b < 4; b++) {
      const twist = s * (b / 3) * (Pp - Pr);
      const R = qFp.clone().multiply(qAxis(Y, twist)).multiply(qFr.clone().invert());
      out.set(k(`fa${b}`), xf(R, Sfa, elbow, arm.elbow));
    }

    // Mano: Y de la muñeca al centro del puño, Z hacia la palma.
    const gripRest = m3.clone().add(handAxis.clone().multiplyScalar(0.008)).add(palmRest.clone().multiplyScalar(0.022));
    const qMr = basisQ(gripRest.clone().sub(wrist), palmRest);
    const qMp = basisQ(arm.grip.clone().sub(arm.wrist), arm.palm);
    const hand = xf(rel(qMp, qMr), axisScale(gripRest.clone().sub(wrist), seg.hand / gripRest.distanceTo(wrist), g), wrist, arm.wrist);
    out.set(k('hand'), hand);

    // Dedos: flexión encadenada alrededor del eje radio-cubital de la mano.
    const flexAxis = X.clone().applyQuaternion(qMr);
    const curl = arm.gripping ? CURL_GRIP : CURL_RELAXED;
    for (const f of FINGERS) {
      let prev = hand;
      for (let j = 0; j < 3; j++) {
        const joint = P(`${f}${j}`);
        prev = composeRot(prev, joint, flexAxis, curl[j]!);
        out.set(k(`${f}${j + 1}`), prev);
      }
    }
    const t0 = P('t0');
    const tDir = P('t1').sub(t0).normalize();
    const tFlex = orth(palmRest.clone().multiplyScalar(0.6).add(radial.clone().multiplyScalar(-0.8)), tDir, palmRest);
    const tAxis = tDir.clone().cross(tFlex).normalize();
    const tc = arm.gripping ? THUMB_GRIP : THUMB_RELAXED;
    const t1 = composeRot(hand, t0, tAxis, tc[0]);
    out.set(k('t1'), t1);
    out.set(k('t2'), composeRot(t1, P('t1'), tAxis, tc[1]));

    // Pierna: muslo con Z hacia el polo de la rodilla; la pierna hereda el eje de bisagra.
    const hjc = P('hjc');
    const knee = P('knee');
    const ankle = P('ankle');
    const qTr = basisQ(knee.clone().sub(hjc), ANTERIOR);
    const qTp = basisQ(leg.knee.clone().sub(leg.hjc), leg.pole);
    out.set(k('thigh'), xf(rel(qTp, qTr), axisScale(knee.clone().sub(hjc), seg.thigh / knee.distanceTo(hjc), g), hjc, leg.hjc));
    const qSr = basisQx(ankle.clone().sub(knee), X.clone().applyQuaternion(qTr));
    const qSp = basisQx(leg.ankle.clone().sub(leg.knee), X.clone().applyQuaternion(qTp));
    out.set(k('shank'), xf(rel(qSp, qSr), axisScale(ankle.clone().sub(knee), seg.shank / ankle.distanceTo(knee), g), knee, leg.knee));

    // Pie: Z del talón a los dedos, Y normal a la planta.
    const heel = P('heel');
    const toe = P('toe');
    const footDir = toe.clone().sub(heel).setY(0);
    const qPr = basisQ(Y, footDir);
    const qPp = basisQ(leg.footUp, leg.toeDir);
    const Sfoot = frameScale(qPr, g, seg.ankleHeight / ankle.y, seg.footLen / footDir.length());
    out.set(k('foot'), xf(rel(qPp, qPr), Sfoot, ankle, leg.ankle));

    // Auxiliares de articulación.
    const get = (n: string) => out.get(n)!;
    out.set(k('h_sc'), helper(thorax, get(k('girdle')), sc));
    out.set(k('h_gh'), helper(get(k('girdle')), get(k('humerus')), gh));
    out.set(k('h_th'), helper(thorax, get(k('humerus')), gh));
    out.set(k('h_el'), helper(get(k('humerus')), get(k('fa0')), elbow));
    out.set(k('h_wr'), helper(get(k('fa3')), hand, wrist));
    out.set(k('h_hip'), helper(pelvis, get(k('thigh')), hjc));
    out.set(k('h_kn'), helper(get(k('thigh')), get(k('shank')), knee));
    out.set(k('h_an'), helper(get(k('shank')), get(k('foot')), ankle));
  }
  for (const name of ctx.bones) if (!out.has(name)) throw new Error(`Hueso sin resolver: ${name}`);
  return out;
}

/** Matriz 4×4 equivalente (para el skinning en GPU). */
export function boneMatrix(b: BoneXf, target = new Matrix4()): Matrix4 {
  const R = new Matrix3().setFromMatrix4(new Matrix4().makeRotationFromQuaternion(b.R));
  const Lm = R.multiply(b.S);
  const e = Lm.elements;
  const t = b.p.clone().sub(b.a.clone().applyMatrix3(Lm));
  // Matrix3 es column-major: e[0], e[1], e[2] = primera columna.
  return target.set(
    e[0]!, e[3]!, e[6]!, t.x,
    e[1]!, e[4]!, e[7]!, t.y,
    e[2]!, e[5]!, e[8]!, t.z,
    0, 0, 0, 1,
  );
}

export const RIG_SIDED_BONES = SIDED;
