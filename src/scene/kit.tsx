import { useMemo } from 'react';
import { Quaternion, Vector3 } from 'three';
import { PLATES } from '../engine/load';

/**
 * Kit de piezas paramétricas común a todas las máquinas: mismo lenguaje visual
 * (perfiles de acero, tapizados, poleas, discos y pila de placas) en todas las estaciones.
 */

const Y = new Vector3(0, 1, 0);

export type V3 = Vector3 | readonly [number, number, number];
const toV = (v: V3) => (v instanceof Vector3 ? v : new Vector3(v[0], v[1], v[2]));

function between(from: V3, to: V3) {
  const a = toV(from);
  const b = toV(to);
  const d = b.clone().sub(a);
  const len = d.length();
  const q = new Quaternion().setFromUnitVectors(Y, len > 1e-9 ? d.clone().divideScalar(len) : Y);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return { mid, q, len };
}

interface MatProps {
  color: string;
  metal?: number;
  rough?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
}

export function Mat({ color, metal = 0.2, rough = 0.6, emissive, emissiveIntensity = 0, opacity = 1 }: MatProps) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={metal}
      roughness={rough}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissiveIntensity}
      transparent={opacity < 1}
      opacity={opacity}
      flatShading
    />
  );
}

/** Perfil de acero de sección cuadrada entre dos puntos. */
export function Beam({ from, to, w = 0.06, color }: { from: V3; to: V3; w?: number; color: string }) {
  const { mid, q, len } = useMemo(() => between(from, to), [from, to]);
  return (
    <mesh position={mid} quaternion={q} castShadow receiveShadow>
      <boxGeometry args={[w, len, w]} />
      <Mat color={color} metal={0.15} rough={0.55} />
    </mesh>
  );
}

/** Tubo cilíndrico entre dos puntos. */
export function Tube({ from, to, r = 0.015, color, metal = 0.3 }: { from: V3; to: V3; r?: number; color: string; metal?: number }) {
  const { mid, q, len } = useMemo(() => between(from, to), [from, to]);
  return (
    <mesh position={mid} quaternion={q} castShadow>
      <cylinderGeometry args={[r, r, len, 10]} />
      <Mat color={color} metal={metal} rough={0.35} />
    </mesh>
  );
}

/** Tapizado (caja) con orientación arbitraria. */
export function Pad({
  position,
  quaternion,
  size,
  color,
}: {
  position: V3;
  quaternion?: Quaternion;
  size: readonly [number, number, number];
  color: string;
}) {
  return (
    <mesh position={toV(position)} quaternion={quaternion} castShadow receiveShadow>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <Mat color={color} metal={0.05} rough={0.85} />
    </mesh>
  );
}

/** Disco/cilindro orientado según `axis`. */
export function Disc({
  position,
  axis,
  radius,
  thickness,
  color,
  metal = 0.15,
}: {
  position: V3;
  axis: Vector3;
  radius: number;
  thickness: number;
  color: string;
  metal?: number;
}) {
  const q = useMemo(() => new Quaternion().setFromUnitVectors(Y, axis.clone().normalize()), [axis]);
  return (
    <mesh position={toV(position)} quaternion={q} castShadow>
      <cylinderGeometry args={[radius, radius, thickness, 24]} />
      <Mat color={color} metal={metal} rough={0.5} />
    </mesh>
  );
}

export function Pulley({ position, axis, r = 0.06, color, hub }: { position: V3; axis: Vector3; r?: number; color: string; hub: string }) {
  return (
    <group>
      <Disc position={position} axis={axis} radius={r} thickness={0.025} color={color} metal={0.25} />
      <Disc position={position} axis={axis} radius={r * 0.35} thickness={0.035} color={hub} metal={0.35} />
    </group>
  );
}

/** Cable como sucesión de tramos rectos. */
export function Cable({ points, color }: { points: readonly Vector3[]; color: string }) {
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    segs.push(<Tube key={i} from={points[i]!} to={points[i + 1]!} r={0.004} color={color} metal={0.4} />);
  }
  return <group>{segs}</group>;
}

/** Pila de placas con guías, pasador y placas levantadas según el desplazamiento del cable. */
export function WeightStack({
  base,
  plates,
  selected,
  lift,
  palette,
}: {
  base: Vector3;
  plates: number;
  selected: number;
  lift: number;
  palette: { frame: string; metal: string; accent: string; pad: string };
}) {
  const plateH = 0.028;
  const gap = 0.004;
  const items = [];
  const top = base.y + plates * (plateH + gap);
  for (let i = 0; i < plates; i++) {
    // i = 0 es la placa superior.
    const lifted = i < selected;
    const y = top - (i + 0.5) * (plateH + gap) + (lifted ? lift : 0);
    items.push(
      <mesh key={i} position={[base.x, y, base.z]} castShadow>
        <boxGeometry args={[0.3, plateH, 0.16]} />
        <Mat color={lifted ? palette.metal : palette.frame} metal={0.25} rough={0.45} />
      </mesh>,
    );
  }
  const pinY = top - (Math.max(1, selected) - 0.5) * (plateH + gap) + lift;
  const railTop = top + 0.75;
  return (
    <group>
      {items}
      <mesh position={[base.x, top + 0.02 + lift, base.z]} castShadow>
        <boxGeometry args={[0.32, 0.04, 0.17]} />
        <Mat color={palette.pad} />
      </mesh>
      <mesh position={[base.x + 0.17, pinY, base.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
        <Mat color={palette.accent} metal={0.3} emissive={palette.accent} emissiveIntensity={0.25} />
      </mesh>
      <Tube from={[base.x - 0.11, base.y, base.z]} to={[base.x - 0.11, railTop, base.z]} r={0.01} color={palette.metal} />
      <Tube from={[base.x + 0.11, base.y, base.z]} to={[base.x + 0.11, railTop, base.z]} r={0.01} color={palette.metal} />
    </group>
  );
}

/** Discos olímpicos montados sobre un eje (horn) a partir de `origin` en la dirección `axis`. */
export function PlateLoad({ origin, axis, plates }: { origin: Vector3; axis: Vector3; plates: readonly number[] }) {
  const out = [];
  let offset = 0.01;
  const ax = axis.clone().normalize();
  for (let i = 0; i < plates.length; i++) {
    const spec = PLATES.find((p) => p.kg === plates[i]) ?? PLATES[0]!;
    const center = origin.clone().add(ax.clone().multiplyScalar(offset + spec.thickness / 2));
    out.push(<Disc key={i} position={center} axis={ax} radius={spec.diameter / 2} thickness={spec.thickness} color={spec.color} />);
    offset += spec.thickness + 0.003;
  }
  return <group>{out}</group>;
}

/** Placa base/pie de máquina. */
export function FootPlate({ position, size, color }: { position: V3; size: readonly [number, number]; color: string }) {
  const p = toV(position);
  return (
    <mesh position={[p.x, 0.01, p.z]} receiveShadow castShadow>
      <boxGeometry args={[size[0], 0.02, size[1]]} />
      <Mat color={color} metal={0.1} rough={0.7} />
    </mesh>
  );
}
