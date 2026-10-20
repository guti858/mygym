import { useState } from 'react';
import { Quaternion, Vector3 } from 'three';
import { AnatomyBody } from '../anatomy/AnatomyBody';
import { useAnatomy } from '../anatomy/useAnatomy';
import type { MuscleId } from '../content/muscles';
import { SIDES, sideSign, type SolvedBody } from '../engine/body';
import { STATUS_RANK } from '../engine/evaluate';
import type { Frame } from '../engine/math';
import type { MetricBase } from '../engine/metrics';
import type { Evaluation, MuscleActivation, Status } from '../engine/types';
import { Mat } from './kit';
import type { ScenePalette } from './palette';

const Y = new Vector3(0, 1, 0);

export type JointKey = 'cadera' | 'rodilla' | 'tobillo' | 'hombro' | 'codo' | 'muneca' | 'lumbar' | 'tronco' | 'cuello';

const METRIC_JOINT: Record<MetricBase, JointKey> = {
  'pelvis.tilt': 'lumbar',
  'lumbar.flex': 'lumbar',
  'thoracic.flex': 'tronco',
  'trunk.incline': 'tronco',
  'neck.flex': 'cuello',
  'scap.elev': 'hombro',
  'scap.prot': 'hombro',
  'shoulder.elev': 'hombro',
  'shoulder.flex': 'hombro',
  'shoulder.abd': 'hombro',
  'shoulder.behind': 'hombro',
  'shoulder.flare': 'hombro',
  'shoulder.horizElev': 'hombro',
  'elbow.flex': 'codo',
  'wrist.ext': 'muneca',
  'hip.flex': 'cadera',
  'hip.abd': 'cadera',
  'knee.flex': 'rodilla',
  'knee.valgus': 'rodilla',
  'ankle.dorsi': 'tobillo',
  'foot.heelLift': 'tobillo',
};

export const metricJoint = (m: MetricBase) => METRIC_JOINT[m];

/** Peor estado por articulación y lado (las axiales usan la clave sin lado). */
export function jointStatuses(evals: readonly Evaluation[]): Map<string, Status> {
  const out = new Map<string, Status>();
  for (const e of evals) {
    const joint = METRIC_JOINT[e.window.metric];
    const key = e.side ? `${joint}.${e.side}` : joint;
    const prev = out.get(key);
    if (!prev || STATUS_RANK[e.status] > STATUS_RANK[prev]) out.set(key, e.status);
  }
  return out;
}

function Capsule({ a, b, r, color }: { a: Vector3; b: Vector3; r: number; color: string }) {
  const d = b.clone().sub(a);
  const len = Math.max(0.001, d.length());
  const q = new Quaternion().setFromUnitVectors(Y, d.divideScalar(len));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return (
    <mesh position={mid} quaternion={q} castShadow>
      <capsuleGeometry args={[r, Math.max(0.001, len - 2 * r * 0.6), 6, 12]} />
      <Mat color={color} metal={0.05} rough={0.7} />
    </mesh>
  );
}

function Ellipsoid({
  center,
  q,
  scale,
  color,
  opacity = 1,
  emissive,
  emissiveIntensity = 0,
}: {
  center: Vector3;
  q: Quaternion;
  scale: readonly [number, number, number];
  color: string;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <mesh position={center} quaternion={q} scale={[scale[0], scale[1], scale[2]]} castShadow={opacity >= 1}>
      <sphereGeometry args={[1, 16, 12]} />
      <Mat color={color} metal={0.05} rough={0.65} opacity={opacity} emissive={emissive} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
}

/** Sistema local de un segmento: Y a lo largo del hueso, Z hacia `front` (proyectado). */
function segmentFrame(a: Vector3, b: Vector3, front: Vector3) {
  const y = b.clone().sub(a).normalize();
  let z = front.clone().sub(y.clone().multiplyScalar(front.dot(y)));
  if (z.lengthSq() < 1e-6) z = new Vector3(0, 0, 1).sub(y.clone().multiplyScalar(y.z));
  z.normalize();
  const x = y.clone().cross(z).normalize();
  return { q: quatFromBasis(x, y, z), y, z, x, len: a.distanceTo(b) };
}

function quatFromBasis(x: Vector3, y: Vector3, z: Vector3): Quaternion {
  // Matriz de rotación con columnas x, y, z → cuaternión.
  const m00 = x.x, m01 = y.x, m02 = z.x;
  const m10 = x.y, m11 = y.y, m12 = z.y;
  const m20 = x.z, m21 = y.z, m22 = z.z;
  const tr = m00 + m11 + m22;
  const q = new Quaternion();
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q.set((m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s);
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q.set(0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s);
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q.set((m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s);
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q.set((m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s);
  }
  return q.normalize();
}

interface Shell {
  muscle: MuscleId;
  center: Vector3;
  q: Quaternion;
  scale: [number, number, number];
}

/** Carcasas musculares: elipsoides anclados a los segmentos del maniquí. */
function muscleShells(body: SolvedBody): Shell[] {
  const { seg } = body;
  const H = seg.H;
  const out: Shell[] = [];
  const th = body.thorax;
  const pv = body.pelvis;
  const lu = body.lumbar;
  const inFrame = (f: Frame, muscle: MuscleId, local: [number, number, number], scale: [number, number, number]) =>
    out.push({ muscle, center: f.point(local[0], local[1], local[2]), q: f.q.clone(), scale });
  const T = seg.thoracic;
  const fr = seg.r.thoraxFront;
  const bk = seg.r.thoraxBack;
  const hw = seg.r.thoraxHalfWidth;

  // Tronco (simétricos).
  for (const s of [1, -1]) {
    inFrame(th, 'pectoral_clavicular', [s * hw * 0.5, T * 0.86, fr * 0.86], [hw * 0.42, T * 0.1, fr * 0.16]);
    inFrame(th, 'pectoral_esternal', [s * hw * 0.48, T * 0.66, fr * 0.84], [hw * 0.46, T * 0.17, fr * 0.2]);
    inFrame(th, 'serrato', [s * hw * 0.92, T * 0.5, fr * 0.35], [hw * 0.12, T * 0.22, fr * 0.3]);
    inFrame(th, 'dorsal_ancho', [s * hw * 0.62, T * 0.42, -bk * 0.9], [hw * 0.42, T * 0.36, bk * 0.35]);
    inFrame(th, 'redondo_mayor', [s * hw * 0.88, T * 0.74, -bk * 0.6], [hw * 0.18, T * 0.1, bk * 0.35]);
    inFrame(th, 'trapecio_medio', [s * hw * 0.32, T * 0.78, -bk * 1.05], [hw * 0.3, T * 0.16, bk * 0.3]);
    inFrame(th, 'trapecio_inferior', [s * hw * 0.2, T * 0.5, -bk * 1.05], [hw * 0.18, T * 0.2, bk * 0.25]);
    inFrame(th, 'trapecio_superior', [s * hw * 0.42, T * 1.0, -bk * 0.15], [hw * 0.38, T * 0.08, bk * 0.6]);
    inFrame(th, 'erectores', [s * hw * 0.16, T * 0.35, -bk * 1.0], [hw * 0.12, T * 0.45, bk * 0.3]);
    inFrame(lu, 'erectores', [s * hw * 0.16, seg.lumbar * 0.5, -bk * 0.75], [hw * 0.13, seg.lumbar * 0.55, bk * 0.32]);
    inFrame(lu, 'abdominales', [s * hw * 0.25, seg.lumbar * 0.55, fr * 0.62], [hw * 0.24, seg.lumbar * 0.6, fr * 0.14]);
    inFrame(pv, 'gluteo_mayor', [s * seg.r.pelvisHalfWidth * 0.48, -0.005 * H, -seg.r.pelvisDepth * 0.95], [seg.r.pelvisHalfWidth * 0.46, 0.05 * H, seg.r.pelvisDepth * 0.42]);
    inFrame(pv, 'gluteo_medio', [s * seg.r.pelvisHalfWidth * 0.86, 0.035 * H, -seg.r.pelvisDepth * 0.25], [seg.r.pelvisHalfWidth * 0.22, 0.035 * H, seg.r.pelvisDepth * 0.42]);
  }

  // Miembros.
  for (const side of SIDES) {
    const s = sideSign(side);
    const arm = body.arms[side];
    const leg = body.legs[side];
    // Brazo: Z hacia la cara anterior (hacia donde se pliega el antebrazo).
    const fore = arm.wrist.clone().sub(arm.elbow);
    const ua = segmentFrame(arm.gh, arm.elbow, fore.lengthSq() > 0 ? fore : th.z);
    const at = (a: Vector3, f: ReturnType<typeof segmentFrame>, t: number, zOff: number, xOff = 0) =>
      a
        .clone()
        .add(f.y.clone().multiplyScalar(f.len * t))
        .add(f.z.clone().multiplyScalar(zOff))
        .add(f.x.clone().multiplyScalar(xOff));
    const rU = seg.r.upperArm;
    out.push({ muscle: 'biceps', center: at(arm.gh, ua, 0.55, rU * 0.55), q: ua.q, scale: [rU * 0.6, ua.len * 0.32, rU * 0.55] });
    out.push({ muscle: 'triceps', center: at(arm.gh, ua, 0.5, -rU * 0.55), q: ua.q, scale: [rU * 0.65, ua.len * 0.36, rU * 0.6] });
    out.push({ muscle: 'braquial', center: at(arm.gh, ua, 0.8, rU * 0.35, s * rU * 0.35), q: ua.q, scale: [rU * 0.45, ua.len * 0.16, rU * 0.45] });
    // Deltoides alrededor de la cabeza humeral (en el sistema del tórax).
    const capR = rU * 1.25;
    const del = (muscle: MuscleId, dir: Vector3) =>
      out.push({ muscle, center: arm.gh.clone().add(dir.normalize().multiplyScalar(capR * 0.6)), q: ua.q, scale: [capR * 0.7, capR * 1.05, capR * 0.7] });
    del('deltoides_anterior', th.dir(s * 0.35, 0.25, 1));
    del('deltoides_lateral', th.dir(s * 1, 0.4, 0));
    del('deltoides_posterior', th.dir(s * 0.35, 0.25, -1));
    // Antebrazo: flexores del lado de la palma.
    const fa = segmentFrame(arm.elbow, arm.wrist, arm.palm);
    out.push({ muscle: 'antebrazo', center: at(arm.elbow, fa, 0.3, seg.r.forearm * 0.5), q: fa.q, scale: [seg.r.forearm * 0.75, fa.len * 0.3, seg.r.forearm * 0.55] });

    // Muslo: Z hacia donde apunta la rodilla.
    const mid = leg.hjc.clone().add(leg.ankle).multiplyScalar(0.5);
    const kneeDir = leg.knee.clone().sub(mid);
    const tg = segmentFrame(leg.hjc, leg.knee, kneeDir.lengthSq() > 1e-4 ? kneeDir : leg.toeDir);
    const rT = seg.r.thigh;
    out.push({ muscle: 'cuadriceps', center: at(leg.hjc, tg, 0.55, rT * 0.45), q: tg.q, scale: [rT * 0.8, tg.len * 0.38, rT * 0.6] });
    out.push({ muscle: 'isquiotibiales', center: at(leg.hjc, tg, 0.55, -rT * 0.45), q: tg.q, scale: [rT * 0.7, tg.len * 0.38, rT * 0.55] });
    out.push({ muscle: 'aductores', center: at(leg.hjc, tg, 0.35, 0, -s * rT * 0.55), q: tg.q, scale: [rT * 0.45, tg.len * 0.3, rT * 0.6] });
    // Pierna: Z hacia los dedos.
    const sh = segmentFrame(leg.knee, leg.ankle, leg.toeDir);
    const rS = seg.r.shank;
    out.push({ muscle: 'gastrocnemio', center: at(leg.knee, sh, 0.3, -rS * 0.6), q: sh.q, scale: [rS * 0.8, sh.len * 0.25, rS * 0.65] });
    out.push({ muscle: 'soleo', center: at(leg.knee, sh, 0.62, -rS * 0.45), q: sh.q, scale: [rS * 0.7, sh.len * 0.22, rS * 0.5] });
  }
  return out;
}

export interface AvatarProps {
  body: SolvedBody;
  palette: ScenePalette;
  statuses: Map<string, Status>;
  muscles: readonly MuscleActivation[];
  /** 0–1: intensidad de activación según la fase. */
  activation: number;
  showMuscles: boolean;
  /** Fase de pulso para articulaciones en riesgo (driven por el fotograma). */
  pulse: number;
  /** Sombra del modelo anatómico (por defecto, sí). */
  castShadow?: boolean;
}

/** Avatar: modelo anatómico (Z-Anatomy) sobre el rig del motor; maniquí simple mientras carga. */
export function Avatar(props: AvatarProps) {
  const model = useAnatomy();
  // Si el modelo llega con la escena ya a la vista, se prepara antes de sustituir al maniquí.
  const [modelAtMount] = useState(() => model !== null);
  if (!model) return <Mannequin {...props} />;
  return (
    <AnatomyBody
      model={model}
      body={props.body}
      palette={props.palette}
      muscles={props.muscles}
      activation={props.activation}
      showMuscles={props.showMuscles}
      castShadow={props.castShadow}
      warm={!modelAtMount}
      fallback={<Mannequin {...props} />}
      overlay={<JointMarkers body={props.body} palette={props.palette} statuses={props.statuses} pulse={props.pulse} xray />}
    />
  );
}

function jointList(body: SolvedBody) {
  const { seg } = body;
  const H = seg.H;
  const th = body.thorax;
  const joints: Array<{ key: string; pos: Vector3; r: number }> = [];
  for (const side of SIDES) {
    const arm = body.arms[side];
    const leg = body.legs[side];
    joints.push(
      { key: `hombro.${side}`, pos: arm.gh, r: seg.r.upperArm * 0.7 },
      { key: `codo.${side}`, pos: arm.elbow, r: seg.r.forearm * 1.05 },
      { key: `muneca.${side}`, pos: arm.wrist, r: seg.r.forearm * 0.8 },
      { key: `cadera.${side}`, pos: leg.hjc, r: seg.r.thigh * 0.62 },
      { key: `rodilla.${side}`, pos: leg.knee, r: seg.r.shank * 1.05 },
      { key: `tobillo.${side}`, pos: leg.ankle, r: seg.r.shank * 0.8 },
    );
  }
  joints.push(
    { key: 'lumbar', pos: body.s1.clone().lerp(body.l1, 0.5), r: 0.03 * H },
    { key: 'tronco', pos: body.l1.clone().lerp(body.c7, 0.5).add(th.dir(0, 0, -seg.r.thoraxBack * 0.6)), r: 0.026 * H },
    { key: 'cuello', pos: body.c7, r: 0.022 * H },
  );
  return joints;
}

/**
 * Estado por articulación (verde/ámbar/rojo). En modo «rayos X» son puntos pequeños que se ven a
 * través de músculos y huesos; en el maniquí, esferas que envuelven la articulación.
 */
function JointMarkers({ body, palette, statuses, pulse, xray = false }: Pick<AvatarProps, 'body' | 'palette' | 'statuses' | 'pulse'> & { xray?: boolean }) {
  const H = body.seg.H;
  return (
    <>
      {jointList(body).map(({ key, pos, r }) => {
        const status: Status | undefined = statuses.get(key) ?? statuses.get(key.split('.')[0]!);
        if (!status) return null;
        const color = palette.status[status];
        const s = status === 'riesgo' ? 1 + 0.18 * Math.sin(pulse) : 1;
        const radius = xray ? (status === 'ok' ? 0.0075 : 0.011) * H : r;
        return (
          <mesh key={`j-${key}`} position={pos} scale={s} renderOrder={xray ? 20 : 0}>
            <sphereGeometry args={[radius, 14, 10]} />
            {xray ? (
              <meshBasicMaterial color={color} transparent opacity={status === 'ok' ? 0.75 : 0.95} depthTest={false} depthWrite={false} />
            ) : (
              <Mat color={color} emissive={color} emissiveIntensity={status === 'ok' ? 0.25 : 0.6} opacity={0.92} />
            )}
          </mesh>
        );
      })}
    </>
  );
}

function Mannequin({ body, palette, statuses, muscles, activation, showMuscles, pulse }: AvatarProps) {
  const { seg } = body;
  const H = seg.H;
  const skin = palette.avatar;
  const dark = palette.avatarDark;
  const parts = [];

  // Tronco: pelvis, abdomen, tórax, cuello y cabeza.
  const pv = body.pelvis;
  const th = body.thorax;
  parts.push(
    <Ellipsoid key="pelvis" center={pv.point(0, 0.01 * H, -0.012 * H)} q={pv.q} scale={[seg.r.pelvisHalfWidth, 0.065 * H, seg.r.pelvisDepth * 0.95]} color={skin} />,
    <Ellipsoid key="abdomen" center={body.lumbar.point(0, seg.lumbar * 0.55, (seg.r.thoraxFront - seg.r.thoraxBack) * 0.32)} q={body.lumbar.q} scale={[seg.r.thoraxHalfWidth * 0.82, seg.lumbar * 0.75, (seg.r.thoraxFront + seg.r.thoraxBack) * 0.4]} color={skin} />,
    <Ellipsoid key="torax" center={th.point(0, seg.thoracic * 0.55, (seg.r.thoraxFront - seg.r.thoraxBack) * 0.5)} q={th.q} scale={[seg.r.thoraxHalfWidth, seg.thoracic * 0.62, (seg.r.thoraxFront + seg.r.thoraxBack) * 0.5]} color={skin} />,
  );
  const neckTop = body.neck.point(0, seg.neck, 0.01 * H);
  parts.push(<Capsule key="cuello" a={body.c7} b={neckTop} r={seg.r.neck} color={skin} />);
  parts.push(<Ellipsoid key="cabeza" center={body.head} q={body.neck.q} scale={[seg.headRadius * 0.86, seg.headRadius, seg.headRadius * 0.95]} color={skin} />);
  parts.push(
    <Ellipsoid key="nariz" center={body.neck.point(0, seg.neck + seg.headAboveNeck - 0.004 * H, 0.012 * H + seg.headRadius * 0.95)} q={body.neck.q} scale={[0.008 * H, 0.012 * H, 0.008 * H]} color={dark} />,
  );

  for (const side of SIDES) {
    const arm = body.arms[side];
    const leg = body.legs[side];
    parts.push(
      <Capsule key={`clav${side}`} a={arm.sc} b={arm.gh} r={0.012 * H} color={dark} />,
      <Ellipsoid key={`hombro${side}`} center={arm.gh} q={th.q} scale={[seg.r.upperArm * 1.25, seg.r.upperArm * 1.2, seg.r.upperArm * 1.2]} color={skin} />,
      <Capsule key={`brazo${side}`} a={arm.gh} b={arm.elbow} r={seg.r.upperArm} color={skin} />,
      <Capsule key={`antebrazo${side}`} a={arm.elbow} b={arm.wrist} r={seg.r.forearm} color={skin} />,
      <Capsule key={`mano${side}`} a={arm.wrist} b={arm.grip} r={seg.r.forearm * 0.85} color={dark} />,
      <Capsule key={`muslo${side}`} a={leg.hjc} b={leg.knee} r={seg.r.thigh} color={skin} />,
      <Capsule key={`pierna${side}`} a={leg.knee} b={leg.ankle} r={seg.r.shank} color={skin} />,
    );
    // Pie: caja del talón a los dedos.
    const footMid = leg.heel.clone().add(leg.toe).multiplyScalar(0.5).add(leg.footUp.clone().multiplyScalar(seg.ankleHeight * 0.45));
    const x = leg.toeDir.clone().cross(leg.footUp).normalize();
    const fq = quatFromBasis(x, leg.footUp.clone().normalize(), leg.toeDir.clone().normalize());
    parts.push(
      <mesh key={`pie${side}`} position={footMid} quaternion={fq} castShadow>
        <boxGeometry args={[0.055 * H, seg.ankleHeight * 0.9, seg.footLen]} />
        <Mat color={dark} rough={0.8} />
      </mesh>,
    );
  }

  const shells = showMuscles
    ? muscleShells(body).flatMap((sh, i) => {
        const act = muscles.find((m) => m.muscle === sh.muscle);
        if (!act) return [];
        const color = palette.muscle[act.role];
        const intensity = (0.25 + 0.25 * act.level) * (0.45 + 0.55 * activation);
        return [
          <Ellipsoid
            key={`m${i}`}
            center={sh.center}
            q={sh.q}
            scale={sh.scale}
            color={color}
            opacity={0.55 + 0.35 * intensity}
            emissive={color}
            emissiveIntensity={0.15 + 0.6 * intensity}
          />,
        ];
      })
    : [];

  return (
    <group>
      {parts}
      {shells}
      <JointMarkers body={body} palette={palette} statuses={statuses} pulse={pulse} />
    </group>
  );
}

export { quatFromBasis };
