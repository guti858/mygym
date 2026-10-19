import { Vector3 } from 'three';
import { Beam, FootPlate, Pad, PlateLoad, Tube } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { BANCA_UPRIGHT_TOP, type BancaMachine } from './logic';

const X = new Vector3(1, 0, 0);
const UPRIGHT_X = 0.58;
const UPRIGHT_Z = -0.12;
const SLEEVE = 0.95;

/** Barra olímpica (2,2 m) con discos IWF a cada lado. */
function Barbell({ c, plates, palette }: { c: Vector3; plates: number[]; palette: ScenePalette }) {
  return (
    <group>
      <Tube from={c.clone().add(X.clone().multiplyScalar(-0.85))} to={c.clone().add(X.clone().multiplyScalar(0.85))} r={0.0125} color={palette.metal} metal={0.8} />
      {[1, -1].map((s) => (
        <group key={s}>
          <Tube from={c.clone().add(X.clone().multiplyScalar(s * 0.85))} to={c.clone().add(X.clone().multiplyScalar(s * 0.9))} r={0.03} color={palette.metal} metal={0.8} />
          <Tube from={c.clone().add(X.clone().multiplyScalar(s * 0.9))} to={c.clone().add(X.clone().multiplyScalar(s * 1.1))} r={0.025} color={palette.metal} metal={0.8} />
          <PlateLoad origin={c.clone().add(X.clone().multiplyScalar(s * SLEEVE))} axis={X.clone().multiplyScalar(s)} plates={plates} />
        </group>
      ))}
    </group>
  );
}

export function BancaMachine3D({ m, palette }: { m: BancaMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const top = m.benchTop;
  return (
    <group>
      <FootPlate position={[0, 0, 0.12]} size={[1.5, 1.6]} color={palette.frameDark} />
      {/* Banco plano */}
      <Pad position={[0, top - 0.04, 0.27]} size={[0.3, 0.08, 1.22]} color={palette.pad} />
      <Beam from={[0, top - 0.1, -0.3]} to={[0, top - 0.1, 0.84]} w={0.07} color={f} />
      {[-0.28, 0.82].map((z) => (
        <group key={z}>
          <Beam from={[0, 0.02, z]} to={[0, top - 0.1, z]} w={0.06} color={f} />
          <Beam from={[-0.22, 0.02, z]} to={[0.22, 0.02, z]} w={0.06} color={f} />
        </group>
      ))}
      {/* Soportes (J) y brazos de seguridad, regulados a tu cuerpo */}
      {[1, -1].map((s) => (
        <group key={s}>
          <Beam from={[s * UPRIGHT_X, 0, UPRIGHT_Z]} to={[s * UPRIGHT_X, BANCA_UPRIGHT_TOP - 0.01, UPRIGHT_Z]} w={0.07} color={f} />
          <Beam from={[s * UPRIGHT_X, 0.03, UPRIGHT_Z - 0.3]} to={[s * UPRIGHT_X, 0.03, UPRIGHT_Z + 0.3]} w={0.07} color={f} />
          <Beam from={[s * UPRIGHT_X, m.hookY, UPRIGHT_Z]} to={[s * UPRIGHT_X, m.hookY, UPRIGHT_Z + 0.12]} w={0.045} color={palette.accent} />
          <Beam from={[s * (UPRIGHT_X - 0.02), m.safetyY, UPRIGHT_Z]} to={[s * (UPRIGHT_X - 0.02), m.safetyY, UPRIGHT_Z + 0.75]} w={0.05} color={palette.metal} />
        </group>
      ))}
      <Beam from={[-UPRIGHT_X, BANCA_UPRIGHT_TOP - 0.04, UPRIGHT_Z]} to={[UPRIGHT_X, BANCA_UPRIGHT_TOP - 0.04, UPRIGHT_Z]} w={0.06} color={f} />
      <Barbell c={m.bar} plates={m.platesPerSide} palette={palette} />
    </group>
  );
}
