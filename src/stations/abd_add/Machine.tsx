import { Quaternion, Vector3 } from 'three';
import { Beam, Cable, FootPlate, Pad, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { qAxis } from '../../engine/math';
import { ABD_BACK, type AbdAddMachine } from './logic';

const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const STACK = new Vector3(0, 0.06, -0.62);

export function AbdAddMachine3D({ m, palette }: { m: AbdAddMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const seat = m.seatY;
  const stackTop = STACK.y + m.stackPlates * 0.032;
  return (
    <group>
      <FootPlate position={[0, 0, -0.05]} size={[1.0, 1.35]} color={palette.frameDark} />
      {/* Bastidor, asiento y respaldo */}
      <Beam from={[0, 0.03, -0.62]} to={[0, 0.03, 0.55]} w={0.08} color={f} />
      <Beam from={[0, 0.03, 0.02]} to={[0, seat - 0.12, 0.02]} w={0.08} color={f} />
      <Pad position={[0, seat - 0.035, 0.04]} size={[0.44, 0.07, 0.42]} color={palette.pad} />
      <Pad position={[0, ABD_BACK.y + 0.05, ABD_BACK.z - 0.035]} quaternion={qAxis(X, -10)} size={[0.44, 0.62, 0.07]} color={palette.pad} />
      <Beam from={[0, seat - 0.1, ABD_BACK.z - 0.1]} to={[0, ABD_BACK.y + 0.3, ABD_BACK.z - 0.16]} w={0.06} color={f} />
      {/* Agarres a los lados del asiento */}
      {(['L', 'R'] as const).map((side) => {
        const h = m.handles[side];
        return (
          <group key={`h${side}`}>
            <Tube from={h.clone().add(new Vector3(0, 0, -0.08))} to={h.clone().add(new Vector3(0, 0, 0.08))} r={0.018} color={palette.pad} metal={0.1} />
            <Beam from={h.clone().add(new Vector3(0, 0, -0.08))} to={[h.x * 0.6, seat - 0.08, h.z - 0.08]} w={0.035} color={f} />
          </group>
        );
      })}
      {/* Brazos de la máquina: eje bajo la cadera, almohadilla en la rodilla y reposapiés */}
      {(['L', 'R'] as const).map((side) => {
        const pv = m.pivots[side];
        const t = m.thighDirs[side];
        const yaw = Math.atan2(t.x, t.z);
        const q = new Quaternion().setFromAxisAngle(Y, yaw);
        const pad = m.pads[side];
        const foot = m.footrests[side];
        const under = new Vector3(pad.x, pv.y, pad.z);
        const footBase = new Vector3(foot.x, foot.y - 0.02, foot.z);
        return (
          <group key={side}>
            <Tube from={pv.clone().add(new Vector3(0, -0.04, 0))} to={pv.clone().add(new Vector3(0, 0.03, 0))} r={0.03} color={palette.metal} />
            <Beam from={pv} to={under} w={0.05} color={f} />
            <Beam from={under} to={pad.clone().add(new Vector3(0, -0.06, 0))} w={0.04} color={f} />
            <Pad position={pad} quaternion={q} size={[0.06, 0.16, 0.22]} color={palette.pad} />
            <Beam from={under} to={footBase} w={0.035} color={f} />
            <Pad position={footBase} quaternion={q} size={[0.12, 0.02, 0.22]} color={palette.frameDark} />
          </group>
        );
      })}
      {/* Pila de placas detrás del respaldo, con el cable hacia el eje de los brazos */}
      <WeightStack base={STACK} plates={m.stackPlates} selected={m.selectedPlates} lift={m.stackLift} palette={palette} />
      <Beam from={[-0.2, 0.03, STACK.z]} to={[-0.2, stackTop + 0.85, STACK.z]} w={0.06} color={f} />
      <Beam from={[0.2, 0.03, STACK.z]} to={[0.2, stackTop + 0.85, STACK.z]} w={0.06} color={f} />
      <Beam from={[-0.2, stackTop + 0.85, STACK.z]} to={[0.2, stackTop + 0.85, STACK.z]} w={0.06} color={f} />
      <Cable points={[new Vector3(0, stackTop + 0.04 + m.stackLift, STACK.z), new Vector3(0, stackTop + 0.8, STACK.z), new Vector3(0, stackTop + 0.8, STACK.z + 0.1), new Vector3(0, seat - 0.12, 0.0)]} color={palette.cable} />
    </group>
  );
}
