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
      case 'hip.abd': {
        // Apertura del muslo respecto al plano sagital de la pelvis.
        const t = leg.knee.clone().sub(leg.hjc);
        const ax = body.pelvis.x;
        push(key, leg.hjc, t.clone().sub(ax.clone().multiplyScalar(t.dot(ax))), t, r * 1.1, true);
        break;
      }
      case 'foot.heelLift':
        out.push({ metric: key, side, center: leg.heel, from: UP, to: UP, radius: 0, value: metrics[`${key}.${side}`] ?? 0, label: leg.heel.clone().add(new Vector3(0, 0.05 * H, 0)) });
        break;
      case 'pelvis.tilt':
        push(key, body.pelvis.origin, body.pelvisRef.y, body.pelvis.y, r * 1.3, false);
        break;
      case 'ankle.dorsi':
        push(key, leg.ankle, leg.footUp, leg.knee.clone().sub(leg.ankle), r * 0.8, true);
        break;
      case 'shoulder.flex':
      case 'shoulder.abd':
      case 'shoulder.flare':
      case 'shoulder.behind': {
        // Ángulo del húmero proyectado en el plano del tórax que define cada métrica.
        const th = body.thorax;
        const u = arm.elbow.clone().sub(arm.gh);
        const drop = (v: Vector3, axis: Vector3) => v.clone().sub(axis.clone().multiplyScalar(v.dot(axis)));
        if (key === 'shoulder.flex') push(key, arm.gh, th.dir(0, -1, 0), drop(u, th.x), r, true);
        else if (key === 'shoulder.abd') push(key, arm.gh, th.dir(0, -1, 0), drop(u, th.z), r, true);
        else if (key === 'shoulder.flare') push(key, arm.gh, drop(u, th.x), u, r * 0.9, true);
        else push(key, arm.gh, drop(u, th.z), u, r * 0.9, true);
        break;
      }
      case 'wrist.ext':
        push(key, arm.wrist, arm.wrist.clone().sub(arm.elbow), arm.grip.clone().sub(arm.wrist), r * 0.55, true);
        break;
      case 'scap.prot':
        out.push({ metric: key, side, center: arm.sc, from: UP, to: UP, radius: 0, value: metrics[`${key}.${side}`] ?? 0, label: arm.sc.clone().add(body.thorax.dir(0, 0.02 * H, 0.07 * H)) });
        break;
      case 'lumbar.flex': {
        const c = body.s1.clone().lerp(body.l1, 0.5);
        out.push({ metric: key, center: c, from: UP, to: UP, radius: 0, value: metrics[key] ?? 0, label: c.clone().add(body.lumbar.dir(0, 0, -0.08 * H)) });
        break;
      }
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
