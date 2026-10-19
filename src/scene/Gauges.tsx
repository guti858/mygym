import { DoubleSide, Vector3 } from 'three';
import type { Status } from '../engine/types';
import { quatFromBasis } from './Avatar';
import type { GaugeArc } from './gauges';

/** Transportador: sector circular en el plano de los dos segmentos, del color del estado. */
function Protractor({ arc, color }: { arc: GaugeArc; color: string }) {
  const x = arc.from.clone().normalize();
  let y = arc.to.clone().sub(x.clone().multiplyScalar(arc.to.dot(x)));
  if (y.lengthSq() < 1e-8) y = new Vector3(0, 1, 0).sub(x.clone().multiplyScalar(x.y));
  y.normalize();
  const z = x.clone().cross(y).normalize();
  const q = quatFromBasis(x, y, z);
  const angle = Math.max(0.001, Math.acos(Math.min(1, Math.max(-1, x.dot(arc.to.clone().normalize())))));
  return (
    <group position={arc.center} quaternion={q} renderOrder={10}>
      <mesh renderOrder={10}>
        <ringGeometry args={[0, arc.radius, 24, 1, 0, angle]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} side={DoubleSide} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh renderOrder={11}>
        <ringGeometry args={[arc.radius * 0.84, arc.radius, 24, 1, 0, angle]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} side={DoubleSide} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Gauges({ arcs, statusOf, colors }: { arcs: readonly GaugeArc[]; statusOf: (a: GaugeArc) => Status | undefined; colors: Record<Status, string> }) {
  return (
    <group>
      {arcs
        .filter((a) => a.radius > 0)
        .map((a) => (
          <Protractor key={`${a.metric}${a.side ?? ''}`} arc={a} color={colors[statusOf(a) ?? 'ok']} />
        ))}
    </group>
  );
}
