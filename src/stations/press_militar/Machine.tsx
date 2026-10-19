import { Vector3 } from 'three';
import { DEG, qAxis } from '../../engine/math';
import { Beam, Cable, FootPlate, Pad, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { MILITAR_BACKREST, type MilitarMachine } from './logic';

const X = new Vector3(1, 0, 0);
const LEVER_X = 0.38;
const STACK = new Vector3(0, 0.06, -1.1);

export function MilitarMachine3D({ m, palette }: { m: MilitarMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const q = qAxis(X, -m.recline);
  const up = new Vector3(0, Math.cos(m.recline * DEG), -Math.sin(m.recline * DEG));
  const n = new Vector3(0, Math.sin(m.recline * DEG), Math.cos(m.recline * DEG));
  const back = new Vector3(0, MILITAR_BACKREST.y, MILITAR_BACKREST.z).add(up.clone().multiplyScalar(0.05)).sub(n.clone().multiplyScalar(0.035));
  const p = m.pivot;
  const stackTop = STACK.y + m.stackPlates * 0.032;
  return (
    <group>
      <FootPlate position={[0, 0, -0.35]} size={[1.0, 1.7]} color={palette.frameDark} />
      {/* Torre trasera con el eje de la palanca */}
      {[-0.14, 0.14].map((x) => (
        <Beam key={x} from={[x, 0, p.z]} to={[x, p.y + 0.14, p.z]} w={0.07} color={f} />
      ))}
      <Beam from={[0, 0.05, p.z]} to={[0, 0.05, 0.45]} w={0.07} color={f} />
      <Beam from={[0, 0.6, p.z]} to={[0, 0.6, MILITAR_BACKREST.z - 0.08]} w={0.06} color={f} />
      <Tube from={p.clone().add(X.clone().multiplyScalar(-LEVER_X - 0.04))} to={p.clone().add(X.clone().multiplyScalar(LEVER_X + 0.04))} r={0.032} color={palette.metal} />

      {/* Palancas y manerales */}
      {(['L', 'R'] as const).map((side) => {
        const s = side === 'L' ? 1 : -1;
        const h = m.handles[side];
        const armEnd = new Vector3(s * LEVER_X, h.y, h.z);
        const hub = new Vector3(s * LEVER_X, p.y, p.z);
        const inner = new Vector3(s * (Math.abs(h.x) - 0.07), h.y, h.z);
        const tangent = new Vector3(0, Math.cos(m.theta), -Math.sin(m.theta));
        return (
          <group key={side}>
            <Beam from={hub} to={armEnd} w={0.05} color={f} />
            <Tube from={armEnd} to={inner} r={0.016} color={palette.metal} />
            {m.handleKind === 'prono' ? (
              <Tube from={new Vector3(s * (Math.abs(h.x) + 0.07), h.y, h.z)} to={inner} r={0.019} color={palette.pad} metal={0.1} />
            ) : (
              <Tube from={h.clone().add(tangent.clone().multiplyScalar(-0.075))} to={h.clone().add(tangent.clone().multiplyScalar(0.075))} r={0.019} color={palette.pad} metal={0.1} />
            )}
          </group>
        );
      })}

      {/* Pila de placas y cable a la leva del eje */}
      <WeightStack base={STACK} plates={m.stackPlates} selected={m.selectedPlates} lift={m.stackLift} palette={palette} />
      <Cable points={[p.clone().add(new Vector3(0, -0.08, -0.04)), new Vector3(0, stackTop + 0.04 + m.stackLift, STACK.z)]} color={palette.cable} />

      {/* Asiento regulable y respaldo */}
      <Beam from={[0, 0.05, 0.02]} to={[0, m.seatY - 0.07, 0.02]} w={0.06} color={f} />
      <Pad position={[0, m.seatY - 0.035, 0.02]} size={[0.42, 0.07, 0.38]} color={palette.pad} />
      <Tube from={[0.04, m.seatY - 0.22, 0.02]} to={[0.11, m.seatY - 0.22, 0.02]} r={0.012} color={palette.accent} />
      <Pad position={back} quaternion={q} size={[0.42, 0.86, 0.07]} color={palette.pad} />
      <Beam from={[0, 0.05, back.z - 0.06]} to={back.clone().sub(n.clone().multiplyScalar(0.05))} w={0.06} color={f} />
    </group>
  );
}
