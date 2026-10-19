import { Vector3 } from 'three';
import type { Side, SolvedBody } from '../engine/body';
import type { MetricBase, Metrics } from '../engine/metrics';

export interface GaugeArc {
  metric: MetricBase;
  side?: Side;
  center: Vector3;
  from: Vector3;
  to: Vector3;
  radius: number;
  value: number;
  /** Punto donde colocar la etiqueta. */
  label: Vector3;
}

const UP = new Vector3(0, 1, 0);

/** Arcos (transportadores) para las métricas clave, en el lado visible desde la vista lateral. */
export function gaugeArcs(body: SolvedBody, metrics: Metrics, keys: readonly MetricBase[], side: Side = 'R'): GaugeArc[] {
  const out: GaugeArc[] = [];
  const H = body.seg.H;
  const arm = body.arms[side];
  const leg = body.legs[side];
  const push = (metric: MetricBase, center: Vector3, from: Vector3, to: Vector3, radius: number, limb: boolean) => {
    const f = from.clone().normalize();
    const t = to.clone().normalize();
    const bis = f.clone().add(t);
    if (bis.lengthSq() < 1e-6) bis.copy(f);
    bis.normalize();
    const value = metrics[limb ? `${metric}.${side}` : metric] ?? 0;
    out.push({ metric, side: limb ? side : undefined, center, from: f, to: t, radius, value, label: center.clone().add(bis.multiplyScalar(radius + 0.07 * H * 0.6)) });
  };
  const r = 0.055 * H;
  for (const key of keys) {
    switch (key) {
      case 'knee.flex':
        push(key, leg.knee, leg.knee.clone().sub(leg.hjc), leg.ankle.clone().sub(leg.knee), r, true);
        break;
      case 'elbow.flex':
        push(key, arm.elbow, arm.elbow.clone().sub(arm.gh), arm.wrist.clone().sub(arm.elbow), r * 0.85, true);
        break;
      case 'hip.flex':
        push(key, leg.hjc, body.pelvis.dir(0, -1, 0), leg.knee.clone().sub(leg.hjc), r * 1.1, true);
        break;
      case 'shoulder.elev':
        push(key, arm.gh, body.thorax.dir(0, -1, 0), arm.elbow.clone().sub(arm.gh), r, true);
        break;
      case 'trunk.incline':
        push(key, body.s1, UP.clone(), body.thorax.y, r * 1.6, false);
        break;
      case 'neck.flex':
        push(key, body.c7, body.thorax.y, body.neck.y, r * 0.8, false);
        break;
      case 'pelvis.tilt':
        push(key, body.pelvis.origin, body.pelvisRef.y, body.pelvis.y, r * 1.3, false);
        break;
      case 'ankle.dorsi':
        push(key, leg.ankle, leg.footUp, leg.knee.clone().sub(leg.ankle), r * 0.8, true);
        break;
      case 'scap.elev':
        out.push({ metric: key, side, center: arm.sc, from: UP, to: UP, radius: 0, value: metrics[`${key}.${side}`] ?? 0, label: arm.sc.clone().add(new Vector3(0, 0.06 * H, 0)) });
        break;
      case 'knee.valgus':
        out.push({ metric: key, side, center: leg.knee, from: UP, to: UP, radius: 0, value: metrics[`${key}.${side}`] ?? 0, label: leg.knee.clone().add(leg.toeDir.clone().multiplyScalar(0.06 * H)) });
        break;
      default:
        break;
    }
  }
  return out;
}
