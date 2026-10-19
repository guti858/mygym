import { Vector3 } from 'three';
import { DEG, qAxis } from '../../engine/math';
import { Beam, Cable, FootPlate, Pad, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { INCLINADO_BACKREST, type InclinadoMachine } from './logic';

const X = new Vector3(1, 0, 0);
const LEVER_X = 0.42;
const STACK = new Vector3(0, 0.06, -1.0);

export function InclinadoMachine3D({ m, palette }: { m: InclinadoMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const q = qAxis(X, -m.recline);
  const up = new Vector3(0, Math.cos(m.recline * DEG), -Math.sin(m.recline * DEG));
  const n = new Vector3(0, Math.sin(m.recline * DEG), Math.cos(m.recline * DEG));
  const backBase = new Vector3(0, INCLINADO_BACKREST.y, INCLINADO_BACKREST.z).sub(n.clone().multiplyScalar(0.035));
  const back = backBase.clone().add(up.clone().multiplyScalar(0.12));
  const head = backBase.clone().add(up.clone().multiplyScalar(0.66));
  const p = m.pivot;
  const stackTop = STACK.y + m.stackPlates * 0.032;
  const tangent = new Vector3(0, Math.sin(60 * DEG), Math.cos(60 * DEG));
  return (
    <group>
      <FootPlate position={[0, 0, -0.2]} size={[1.1, 1.8]} color={palette.frameDark} />
      {/* Torre con el eje alto de las palancas */}
      {[-0.5, 0.5].map((x) => (
        <Beam key={x} from={[x, 0, p.z]} to={[x, p.y + 0.12, p.z]} w={0.07} color={f} />
      ))}
      <Beam from={[-0.54, p.y + 0.12, p.z]} to={[0.54, p.y + 0.12, p.z]} w={0.07} color={f} />
      <Beam from={[0, 0.05, p.z]} to={[0, 0.05, 0.6]} w={0.07} color={f} />
      <Tube from={p.clone().add(X.clone().multiplyScalar(-LEVER_X - 0.05))} to={p.clone().add(X.clone().multiplyScalar(LEVER_X + 0.05))} r={0.03} color={palette.metal} />

      {/* Palancas convergentes y manerales */}
      {(['L', 'R'] as const).map((side) => {
        const s = side === 'L' ? 1 : -1;
        const h = m.handles[side];
        const hub = new Vector3(s * LEVER_X, p.y, p.z);
        const elbowPt = new Vector3(s * (Math.abs(h.x) + 0.1), h.y + 0.02, h.z - 0.05);
        return (
          <group key={side}>
            <Beam from={hub} to={elbowPt} w={0.05} color={f} />
            {m.handleKind === 'prono' ? (
              <>
                <Tube from={elbowPt} to={new Vector3(s * (Math.abs(h.x) - 0.08), h.y, h.z)} r={0.016} color={palette.metal} />
                <Tube from={new Vector3(s * (Math.abs(h.x) + 0.06), h.y, h.z)} to={new Vector3(s * (Math.abs(h.x) - 0.06), h.y, h.z)} r={0.02} color={palette.pad} metal={0.1} />
              </>
            ) : (
              <>
                <Tube from={elbowPt} to={h} r={0.016} color={palette.metal} />
                <Tube from={h.clone().add(tangent.clone().multiplyScalar(-0.07)).add(new Vector3(0, -0.05, 0))} to={h.clone().add(tangent.clone().multiplyScalar(0.07)).add(new Vector3(0, 0.05, 0))} r={0.02} color={palette.pad} metal={0.1} />
              </>
            )}
          </group>
        );
      })}

      <WeightStack base={STACK} plates={m.stackPlates} selected={m.selectedPlates} lift={m.stackLift} palette={palette} />
      <Cable points={[p.clone().add(new Vector3(0, -0.06, -0.06)), new Vector3(0, stackTop + 0.04 + m.stackLift, STACK.z)]} color={palette.cable} />

      {/* Asiento regulable y respaldo inclinado */}
      <Beam from={[0, 0.05, 0.08]} to={[0, m.seatY - 0.07, 0.08]} w={0.06} color={f} />
      <Pad position={[0, m.seatY - 0.035, 0.1]} size={[0.44, 0.07, 0.4]} color={palette.pad} />
      <Tube from={[0.04, m.seatY - 0.22, 0.08]} to={[0.11, m.seatY - 0.22, 0.08]} r={0.012} color={palette.accent} />
      <Pad position={back} quaternion={q} size={[0.44, 0.8, 0.07]} color={palette.pad} />
      <Pad position={head} quaternion={q} size={[0.26, 0.2, 0.07]} color={palette.pad} />
      <Beam from={[0, 0.05, back.z - 0.15]} to={back.clone().sub(n.clone().multiplyScalar(0.05))} w={0.06} color={f} />
    </group>
  );
}
