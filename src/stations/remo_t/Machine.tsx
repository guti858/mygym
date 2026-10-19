import { Vector3 } from 'three';
import { Beam, Pad, PlateLoad, Tube } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { REMO_PAD_LENGTH, REMO_PIVOT, REMO_PLATFORM_Z, type RemoMachine } from './logic';

const X = new Vector3(1, 0, 0);
const NX = new Vector3(-1, 0, 0);
const RAIL_X = 0.44;

export function RemoMachine3D({ m, palette }: { m: RemoMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const h = m.crossbar;
  const sl = m.sleeve;
  const top = m.platformY;
  const neutral = m.grip === 'neutro';
  return (
    <group>
      {/* Plataforma: dos placas a los lados de la palanca */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Pad
            position={[s * 0.27, top / 2, (REMO_PLATFORM_Z.back + REMO_PLATFORM_Z.front) / 2]}
            size={[0.38, top, REMO_PLATFORM_Z.front - REMO_PLATFORM_Z.back]}
            color={palette.frameDark}
          />
          <Beam from={[s * 0.07, 0.02, REMO_PLATFORM_Z.back]} to={[s * 0.07, 0.02, REMO_PLATFORM_Z.front]} w={0.04} color={f} />
        </group>
      ))}
      {/* Anclaje: soporte con eje transversal */}
      <Beam from={[-0.12, 0.03, REMO_PIVOT.z]} to={[0.12, 0.03, REMO_PIVOT.z]} w={0.08} color={f} />
      <Beam from={[0, 0.03, REMO_PIVOT.z]} to={[0, REMO_PIVOT.y, REMO_PIVOT.z]} w={0.06} color={f} />
      <Tube from={REMO_PIVOT.clone().add(new Vector3(-0.07, 0, 0))} to={REMO_PIVOT.clone().add(new Vector3(0.07, 0, 0))} r={0.02} color={palette.metal} />
      {/* Palanca y eje de discos */}
      <Tube from={REMO_PIVOT} to={sl} r={0.024} color={palette.metal} />
      <Tube from={sl.clone().add(new Vector3(-0.32, 0, 0))} to={sl.clone().add(new Vector3(0.32, 0, 0))} r={0.025} color={palette.metal} />
      <PlateLoad origin={sl.clone().add(new Vector3(0.06, 0, 0))} axis={X} plates={m.platesPerSide} />
      <PlateLoad origin={sl.clone().add(new Vector3(-0.06, 0, 0))} axis={NX} plates={m.platesPerSide} />
      {/* Maneral: soporte sobre la palanca y travesaño con agarres anchos (prono) y asas paralelas (neutro) */}
      <Beam from={m.handle} to={h} w={0.04} color={f} />
      <Tube from={h.clone().add(new Vector3(-0.33, 0, 0))} to={h.clone().add(new Vector3(0.33, 0, 0))} r={0.016} color={palette.metal} />
      {(['L', 'R'] as const).map((side) => {
        const s = side === 'L' ? 1 : -1;
        const wide = h.clone().add(new Vector3(s * 0.29, 0, 0));
        const nx = s * 0.075;
        return (
          <group key={side}>
            <Tube from={wide.clone().add(new Vector3(-0.055, 0, 0))} to={wide.clone().add(new Vector3(0.055, 0, 0))} r={0.02} color={neutral ? palette.metal : palette.pad} metal={neutral ? 0.3 : 0.1} />
            <Tube from={h.clone().add(new Vector3(nx, 0, 0))} to={h.clone().add(new Vector3(nx, -0.07, 0))} r={0.012} color={palette.metal} />
            <Tube
              from={h.clone().add(new Vector3(nx, -0.07, -0.06))}
              to={h.clone().add(new Vector3(nx, -0.07, 0.06))}
              r={0.02}
              color={neutral ? palette.pad : palette.metal}
              metal={neutral ? 0.1 : 0.3}
            />
          </group>
        );
      })}
      {/* Almohadilla de pecho (versión con apoyo) con dos guías hasta la plataforma */}
      {m.pad && <ChestPad pad={m.pad} top={top} palette={palette} />}
    </group>
  );
}

function ChestPad({ pad, top, palette }: { pad: NonNullable<RemoMachine['pad']>; top: number; palette: ScenePalette }) {
  const along = new Vector3(0, 1, 0).applyQuaternion(pad.q);
  const normal = new Vector3(0, 0, 1).applyQuaternion(pad.q);
  // Soporte desde el borde superior (junto a la cabeza): fuera del recorrido del maneral.
  const high = pad.center.clone().add(along.clone().multiplyScalar(0.12)).add(normal.clone().multiplyScalar(0.05));
  return (
    <group>
      <Pad position={pad.center} quaternion={pad.q} size={[0.32, REMO_PAD_LENGTH, 0.07]} color={palette.pad} />
      {/* Travesaño bajo el borde superior y dos postes por fuera de los agarres */}
      <Beam from={[-RAIL_X, high.y, high.z]} to={[RAIL_X, high.y, high.z]} w={0.04} color={palette.frame} />
      {[-1, 1].map((s) => (
        <Beam key={s} from={[s * RAIL_X, high.y, high.z]} to={[s * RAIL_X, top, high.z]} w={0.045} color={palette.frame} />
      ))}
    </group>
  );
}
