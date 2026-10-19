import { Vector3 } from 'three';
import { quatFromBasis } from '../../scene/Avatar';
import { Beam, FootPlate, Mat, Pad, PlateLoad, Tube } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import type { PrensaMachine } from './logic';

const X = new Vector3(1, 0, 0);

export function PrensaMachine3D({ m, palette, H }: { m: PrensaMachine; palette: ScenePalette; H: number }) {
  const f = palette.frame;
  const d = m.railDir;
  const up = m.platformUp;
  const normal = d.clone().negate();
  // Línea de los raíles: por debajo de la plataforma.
  const railAt = (s: number) => m.hjc.clone().add(d.clone().multiplyScalar(s)).sub(up.clone().multiplyScalar(0.0875 + 0.36));
  const r0 = railAt(0.25);
  const r1 = railAt(2.05);
  const platformQ = quatFromBasis(X, up, d);
  const platformCenter = m.platformCenter.clone().add(up.clone().multiplyScalar(0.1)).add(d.clone().multiplyScalar(0.025));
  const carriage = railAt(m.sled).add(d.clone().multiplyScalar(0.05)).add(up.clone().multiplyScalar(0.07));
  const pv = m.pelvisRef;
  const seatQ = pv.q.clone();
  const stopS = m.sledBottom - 0.04;

  return (
    <group>
      <FootPlate position={[0, 0, 0.75]} size={[1.1, 2.6]} color={palette.frameDark} />
      {/* Raíles */}
      {[-0.22, 0.22].map((x) => (
        <Beam key={x} from={r0.clone().add(X.clone().multiplyScalar(x))} to={r1.clone().add(X.clone().multiplyScalar(x))} w={0.07} color={f} />
      ))}
      <Beam from={[0, 0, r0.z]} to={r0} w={0.08} color={f} />
      <Beam from={[0, 0, r1.z]} to={r1} w={0.08} color={f} />
      <Beam from={[0, 0.04, -0.6]} to={[0, 0.04, r1.z]} w={0.08} color={f} />
      {/* Topes de seguridad (ajustados a tu profundidad recomendada) */}
      {[-0.22, 0.22].map((x) => (
        <mesh key={`stop${x}`} position={railAt(stopS).add(X.clone().multiplyScalar(x)).add(up.clone().multiplyScalar(0.06))} quaternion={platformQ}>
          <boxGeometry args={[0.09, 0.06, 0.05]} />
          <Mat color={palette.accent} emissive={palette.accent} emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Carro y plataforma */}
      <mesh position={carriage} quaternion={platformQ} castShadow>
        <boxGeometry args={[0.56, 0.12, 0.42]} />
        <Mat color={palette.frameDark} metal={0.15} rough={0.5} />
      </mesh>
      <mesh position={platformCenter} quaternion={platformQ} castShadow receiveShadow>
        <boxGeometry args={[0.78, 0.74, 0.04]} />
        <Mat color={palette.frame} metal={0.15} rough={0.55} opacity={0.55} />
      </mesh>
      <Beam from={carriage} to={platformCenter.clone().add(normal.clone().multiplyScalar(-0.02))} w={0.06} color={f} />
      {/* Cuernos con discos */}
      {[1, -1].map((s) => {
        const origin = carriage.clone().add(X.clone().multiplyScalar(s * 0.3)).add(up.clone().multiplyScalar(0.06));
        const axis = X.clone().multiplyScalar(s);
        return (
          <group key={`horn${s}`}>
            <Tube from={origin} to={origin.clone().add(axis.clone().multiplyScalar(0.3))} r={0.025} color={palette.metal} />
            <PlateLoad origin={origin} axis={axis} plates={m.platesPerSide} />
          </group>
        );
      })}

      {/* Asiento y respaldo */}
      <Pad position={pv.point(0, 0.28 * H * 0.9, -0.08 * H - 0.04)} quaternion={seatQ} size={[0.44, 0.62, 0.07]} color={palette.pad} />
      <Pad position={pv.point(0, 0.56 * H * 0.9, -0.08 * H - 0.02)} quaternion={seatQ} size={[0.26, 0.16, 0.06]} color={palette.pad} />
      <Pad position={pv.point(0, -0.06 * H - 0.035, 0.02 * H)} quaternion={seatQ} size={[0.44, 0.07, 0.3]} color={palette.pad} />
      <Beam from={pv.point(0, 0.2 * H, -0.08 * H - 0.09)} to={[0, 0.04, pv.point(0, 0.2 * H, -0.08 * H - 0.09).z]} w={0.06} color={f} />
      <Beam from={pv.point(0, -0.06 * H - 0.08, 0.02 * H)} to={[0, 0.04, pv.point(0, -0.06 * H - 0.08, 0.02 * H).z]} w={0.06} color={f} />
      {/* Asideros laterales */}
      {[1, -1].map((s) => {
        const g = pv.point(s * 0.17 * H, 0.03 * H, 0.05 * H);
        return (
          <group key={`asa${s}`}>
            <Tube from={g.clone().add(pv.dir(0, 0, -0.06))} to={g.clone().add(pv.dir(0, 0, 0.06))} r={0.016} color={palette.pad} metal={0.1} />
            <Tube from={g.clone().add(pv.dir(0, 0, -0.06))} to={pv.point(s * 0.2, -0.06 * H - 0.05, -0.02)} r={0.012} color={palette.metal} />
          </group>
        );
      })}
    </group>
  );
}
