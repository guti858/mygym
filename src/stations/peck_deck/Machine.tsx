import { Vector3 } from 'three';
import { qAxis } from '../../engine/math';
import { Beam, Cable, FootPlate, Pad, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { PECK_BACK, PECK_CHEST_Z, PECK_HANDLE_Y, type PeckMachine } from './logic';

const X = new Vector3(1, 0, 0);
const TOP = 2.02;

export function PeckMachine3D({ m, palette }: { m: PeckMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const front = m.mode === 'pajaro';
  // La torre queda detrás del respaldo (aperturas) o delante de la almohadilla de pecho (pájaro).
  const towerZ = front ? 0.62 : -0.5;
  const stack = new Vector3(0, 0.06, towerZ + (front ? 0.2 : -0.2));
  const stackTop = stack.y + m.stackPlates * 0.032;
  const axisZ = (m.axes.L.z + m.axes.R.z) / 2;
  return (
    <group>
      <FootPlate position={[0, 0, front ? 0.25 : -0.2]} size={[1.0, 1.5]} color={palette.frameDark} />
      {[-0.14, 0.14].map((x) => (
        <Beam key={x} from={[x, 0, towerZ]} to={[x, TOP + 0.06, towerZ]} w={0.07} color={f} />
      ))}
      <Beam from={[0, TOP, towerZ]} to={[0, TOP, axisZ]} w={0.07} color={f} />
      <Beam from={[m.axes.R.x, TOP, axisZ]} to={[m.axes.L.x, TOP, axisZ]} w={0.06} color={f} />
      <Beam from={[0, 0.05, towerZ]} to={[0, 0.05, 0.02]} w={0.07} color={f} />

      {(['L', 'R'] as const).map((side) => {
        const a = m.axes[side];
        const h = m.handles[side];
        const pivot = new Vector3(a.x, TOP, a.z);
        const top = h.clone().add(new Vector3(0, 0.3, 0));
        return (
          <group key={side}>
            <Tube from={pivot.clone().add(new Vector3(0, 0.05, 0))} to={pivot.clone().add(new Vector3(0, -0.06, 0))} r={0.035} color={palette.metal} />
            <Beam from={pivot} to={top} w={0.045} color={f} />
            <Tube from={top} to={h.clone().add(new Vector3(0, 0.08, 0))} r={0.014} color={palette.metal} />
            <Tube from={h.clone().add(new Vector3(0, 0.08, 0))} to={h.clone().add(new Vector3(0, -0.08, 0))} r={0.019} color={palette.pad} metal={0.1} />
          </group>
        );
      })}

      <WeightStack base={stack} plates={m.stackPlates} selected={m.selectedPlates} lift={m.stackLift} palette={palette} />
      <Cable points={[new Vector3(0, TOP - 0.04, towerZ), new Vector3(0, stackTop + 0.04 + m.stackLift, stack.z)]} color={palette.cable} />

      <Beam from={[0, 0.05, 0.02]} to={[0, m.seatY - 0.07, 0.02]} w={0.06} color={f} />
      <Pad position={[0, m.seatY - 0.035, 0.02]} size={[0.42, 0.07, 0.38]} color={palette.pad} />
      <Tube from={[0.04, m.seatY - 0.22, 0.02]} to={[0.11, m.seatY - 0.22, 0.02]} r={0.012} color={palette.accent} />
      {front ? (
        <>
          <Pad position={[0, PECK_HANDLE_Y - 0.08, PECK_CHEST_Z + 0.035]} size={[0.34, 0.5, 0.07]} color={palette.pad} />
          <Beam from={[0, 0.05, PECK_CHEST_Z + 0.12]} to={[0, PECK_HANDLE_Y - 0.16, PECK_CHEST_Z + 0.12]} w={0.06} color={f} />
          <Beam from={[0, PECK_HANDLE_Y - 0.16, PECK_CHEST_Z + 0.12]} to={[0, PECK_HANDLE_Y - 0.16, PECK_CHEST_Z + 0.07]} w={0.05} color={f} />
        </>
      ) : (
        <>
          <Pad position={[0, PECK_BACK.y + 0.05, PECK_BACK.z - 0.035]} quaternion={qAxis(X, -3)} size={[0.42, 0.85, 0.07]} color={palette.pad} />
          <Beam from={[0, 0.05, PECK_BACK.z - 0.12]} to={[0, PECK_BACK.y, PECK_BACK.z - 0.12]} w={0.06} color={f} />
        </>
      )}
    </group>
  );
}
