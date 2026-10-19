import { Vector3 } from 'three';
import { SIDES, type Side, type SolvedBody, dorsiflexion, hipFlexion, sideSign } from './body';
import { RAD, angleDeg, clamp, signedAngleAround } from './math';

/**
 * Métricas articulares (goniometría en 3D, independientes de la cámara).
 * Las métricas de miembro llevan sufijo de lado: `knee.flex.L`.
 */
export const METRIC_INFO = {
  'pelvis.tilt': { label: 'Pelvis · basculación', unit: '°', hint: '+ anteversión / − retroversión' },
  'lumbar.flex': { label: 'Columna lumbar · flexión', unit: '°', hint: '+ flexión / − extensión' },
  'thoracic.flex': { label: 'Columna torácica · flexión', unit: '°', hint: '+ flexión / − extensión' },
  'trunk.incline': { label: 'Tronco · inclinación', unit: '°', hint: '+ adelante / − atrás (respecto a la vertical)' },
  'neck.flex': { label: 'Cuello · flexión', unit: '°', hint: '+ flexión / − extensión' },
  'scap.elev': { label: 'Escápula · elevación', unit: '°', hint: '+ elevación / − depresión' },
  'scap.prot': { label: 'Escápula · protracción', unit: '°', hint: '+ protracción / − retracción' },
  'shoulder.elev': { label: 'Hombro · elevación del húmero', unit: '°', hint: '0 = brazo colgando' },
  'shoulder.flex': { label: 'Hombro · flexión (sagital)', unit: '°', hint: '+ flexión / − extensión' },
  'shoulder.abd': { label: 'Hombro · abducción (frontal)', unit: '°', hint: 'separación del brazo respecto al tronco' },
  'shoulder.behind': { label: 'Hombro · por detrás del plano frontal', unit: '°', hint: '+ húmero por detrás del tronco' },
  'shoulder.flare': { label: 'Hombro · apertura del codo', unit: '°', hint: 'ángulo del brazo respecto al plano sagital (0 = codo pegado)' },
  'shoulder.horizElev': {
    label: 'Hombro · abducción horizontal con brazo elevado',
    unit: '°',
    hint: 'húmero por detrás del tronco con el brazo elevado por encima de ~80°',
  },
  'elbow.flex': { label: 'Codo · flexión', unit: '°', hint: '0 = extendido' },
  'wrist.ext': { label: 'Muñeca · extensión', unit: '°', hint: '+ extensión / − flexión' },
  'hip.flex': { label: 'Cadera · flexión', unit: '°', hint: '0 = muslo alineado con el tronco' },
  'hip.abd': { label: 'Cadera · abducción', unit: '°', hint: '+ separación del muslo' },
  'knee.flex': { label: 'Rodilla · flexión', unit: '°', hint: '0 = extendida' },
  'knee.valgus': { label: 'Rodilla · desvío medial (valgo)', unit: '°', hint: '+ rodilla hacia dentro respecto al pie' },
  'ankle.dorsi': { label: 'Tobillo · flexión dorsal', unit: '°', hint: '+ rodilla por delante del pie' },
  'foot.heelLift': { label: 'Pie · talón despegado', unit: '°', hint: '0 = talón apoyado' },
} as const;

export type MetricBase = keyof typeof METRIC_INFO;

export const LIMB_METRICS: ReadonlySet<MetricBase> = new Set<MetricBase>([
  'scap.elev',
  'scap.prot',
  'shoulder.elev',
  'shoulder.flex',
  'shoulder.abd',
  'shoulder.behind',
  'shoulder.flare',
  'shoulder.horizElev',
  'elbow.flex',
  'wrist.ext',
  'hip.flex',
  'hip.abd',
  'knee.flex',
  'knee.valgus',
  'ankle.dorsi',
  'foot.heelLift',
]);

export type Metrics = Record<string, number>;

export interface MeasureRef {
  /** Dirección horizontal hacia la que mira el usuario (para la inclinación del tronco). */
  forward: Vector3;
}

export function measure(body: SolvedBody, ref: MeasureRef): Metrics {
  const m: Metrics = {};
  const ax = body.axial;
  m['pelvis.tilt'] = ax.pelvisTilt;
  m['lumbar.flex'] = ax.lumbarFlex;
  m['thoracic.flex'] = ax.thoracicFlex;
  m['neck.flex'] = ax.neckFlex;

  const up = new Vector3(0, 1, 0);
  const fwd = ref.forward.clone().setY(0).normalize();
  const thY = body.thorax.y;
  m['trunk.incline'] = Math.atan2(thY.dot(fwd), thY.dot(up)) * RAD;

  for (const side of SIDES) {
    const s = sideSign(side);
    const arm = body.arms[side];
    const leg = body.legs[side];
    const k = (base: MetricBase) => `${base}.${side}`;

    m[k('scap.elev')] = ax.scapElev;
    m[k('scap.prot')] = ax.scapProt;
    m[k('wrist.ext')] = ax.wristExt;

    const u = body.thorax.toLocalDir(arm.elbow.clone().sub(arm.gh).normalize());
    m[k('shoulder.elev')] = angleDeg(u, new Vector3(0, -1, 0));
    m[k('shoulder.flex')] = unwrap(Math.atan2(u.z, -u.y) * RAD);
    m[k('shoulder.abd')] = unwrap(Math.atan2(s * u.x, -u.y) * RAD);
    const behind = Math.asin(clamp(-u.z, -1, 1)) * RAD;
    m[k('shoulder.flare')] = Math.asin(clamp(s * u.x, -1, 1)) * RAD;
    m[k('shoulder.behind')] = behind;
    m[k('shoulder.horizElev')] = behind * clamp((m[k('shoulder.elev')]! - 70) / 20, 0, 1);
    m[k('elbow.flex')] =
      180 - angleDeg(arm.gh.clone().sub(arm.elbow), arm.wrist.clone().sub(arm.elbow));

    m[k('hip.flex')] = unwrap(hipFlexion(body.pelvis, leg.hjc, leg.knee));
    const t = body.pelvis.toLocalDir(leg.knee.clone().sub(leg.hjc).normalize());
    m[k('hip.abd')] = Math.asin(clamp(s * t.x, -1, 1)) * RAD;
    m[k('knee.flex')] =
      180 - angleDeg(leg.hjc.clone().sub(leg.knee), leg.ankle.clone().sub(leg.knee));
    m[k('knee.valgus')] = kneeValgus(leg.hjc, leg.knee, leg.ankle, leg.toeDir, side);
    m[k('ankle.dorsi')] = dorsiflexion(leg.knee, leg.ankle, leg.toeDir);
    m[k('foot.heelLift')] = leg.heelLift;
  }
  return m;
}

/** Lleva ángulos de (−180, −120) a (180, 240) para que las elevaciones por encima de la cabeza no salten de signo. */
const unwrap = (deg: number) => (deg < -120 ? deg + 360 : deg);

/**
 * Desvío de la rodilla respecto a la dirección del pie, alrededor del eje cadera–tobillo.
 * + = hacia la línea media (valgo dinámico).
 */
export function kneeValgus(
  hjc: Vector3,
  knee: Vector3,
  ankle: Vector3,
  toeDir: Vector3,
  side: Side,
): number {
  const axis = ankle.clone().sub(hjc).normalize();
  const off = knee.clone().sub(hjc);
  const perpK = off.sub(axis.clone().multiplyScalar(off.dot(axis)));
  if (perpK.length() < 0.01) return 0; // pierna casi extendida: el desvío no está definido
  return sideSign(side) * signedAngleAround(toeDir, perpK, axis);
}

/** Valor representativo de una métrica: si es de miembro, el peor (mayor desvío) de ambos lados. */
export function metricValue(m: Metrics, base: MetricBase, side?: Side): number {
  if (!LIMB_METRICS.has(base)) return m[base] ?? 0;
  if (side) return m[`${base}.${side}`] ?? 0;
  const l = m[`${base}.L`] ?? 0;
  const r = m[`${base}.R`] ?? 0;
  return Math.abs(l) >= Math.abs(r) ? l : r;
}
