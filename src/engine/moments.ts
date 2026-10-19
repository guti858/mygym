import { Vector3 } from 'three';
import { SIDES, type Side, type SolvedBody } from './body';

/** Fuerza externa aplicada sobre el cuerpo en un punto de contacto (N). */
export interface ContactForce {
  limb: 'arm' | 'leg';
  side: Side;
  point: Vector3;
  force: Vector3;
}

export type JointMomentId = 'hombro' | 'codo' | 'cadera' | 'rodilla' | 'tobillo';

export const JOINT_MOMENT_LABEL: Record<JointMomentId, string> = {
  hombro: 'Hombro',
  codo: 'Codo',
  cadera: 'Cadera',
  rodilla: 'Rodilla',
  tobillo: 'Tobillo',
};

/**
 * Momento externo estático (N·m) en cada articulación: |Σ (P − J) × F| de las fuerzas distales.
 * Estimación educativa: ignora inercia y el peso de los segmentos.
 */
export function jointMoments(body: SolvedBody, forces: ContactForce[]): Record<JointMomentId, number> {
  const out: Record<JointMomentId, number> = { hombro: 0, codo: 0, cadera: 0, rodilla: 0, tobillo: 0 };
  for (const side of SIDES) {
    const arm = body.arms[side];
    const leg = body.legs[side];
    const armF = forces.filter((f) => f.limb === 'arm' && f.side === side);
    const legF = forces.filter((f) => f.limb === 'leg' && f.side === side);
    const mom = (joint: Vector3, fs: ContactForce[]) => {
      const total = new Vector3();
      for (const f of fs) total.add(f.point.clone().sub(joint).cross(f.force));
      return total.length();
    };
    out.hombro = Math.max(out.hombro, mom(arm.gh, armF));
    out.codo = Math.max(out.codo, mom(arm.elbow, armF));
    out.cadera = Math.max(out.cadera, mom(leg.hjc, legF));
    out.rodilla = Math.max(out.rodilla, mom(leg.knee, legF));
    out.tobillo = Math.max(out.tobillo, mom(leg.ankle, legF));
  }
  return out;
}
