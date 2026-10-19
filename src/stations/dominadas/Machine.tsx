import { Vector3 } from 'three';
import { Beam, Cable, Disc, FootPlate, Pad, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { DOMINADAS_PARALLEL_HALF, DOMINADAS_PARALLEL_Z, type DominadasMachine } from './logic';

const Z = new Vector3(0, 0, 1);
/** Torre delante del usuario (mira hacia ella); la barra sale en voladizo hacia atrás. */
const TOWER_Z = 0.62;
const OUTER = 0.62;
const TOP = 2.48;
const STACK = new Vector3(0, 0.06, TOWER_Z + 0.06);
const BAR_HALF = 0.62;
/** La barra recta pasa por z = 0 (donde la lógica coloca los agarres prono y supino). */
const BAR_Z = 0;

export function DominadasMachine3D({ m, palette }: { m: DominadasMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const y = m.barY;
  const stackTop = STACK.y + 14 * 0.032;
  return (
    <group>
      <FootPlate position={[0, 0, TOWER_Z - 0.2]} size={[1.4, 1.0]} color={palette.frameDark} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Beam from={[s * OUTER, 0, TOWER_Z]} to={[s * OUTER, TOP, TOWER_Z]} w={0.08} color={f} />
          {/* Voladizo hasta la barra */}
          <Beam from={[s * OUTER, y + 0.06, TOWER_Z]} to={[s * OUTER, y + 0.06, BAR_Z]} w={0.07} color={f} />
          <Beam from={[s * OUTER, y + 0.06, BAR_Z]} to={[s * OUTER, y, BAR_Z]} w={0.05} color={f} />
          {/* Asas paralelas (agarre neutro) colgadas de un travesaño */}
          <Beam from={[s * DOMINADAS_PARALLEL_HALF, y + 0.06, DOMINADAS_PARALLEL_Z - 0.12]} to={[s * DOMINADAS_PARALLEL_HALF, y + 0.06, DOMINADAS_PARALLEL_Z + 0.12]} w={0.04} color={f} />
          <Tube from={[s * DOMINADAS_PARALLEL_HALF, y + 0.06, DOMINADAS_PARALLEL_Z - 0.1]} to={[s * DOMINADAS_PARALLEL_HALF, y, DOMINADAS_PARALLEL_Z - 0.1]} r={0.012} color={palette.metal} />
          <Tube from={[s * DOMINADAS_PARALLEL_HALF, y + 0.06, DOMINADAS_PARALLEL_Z + 0.1]} to={[s * DOMINADAS_PARALLEL_HALF, y, DOMINADAS_PARALLEL_Z + 0.1]} r={0.012} color={palette.metal} />
          <Tube
            from={[s * DOMINADAS_PARALLEL_HALF, y, DOMINADAS_PARALLEL_Z - 0.1]}
            to={[s * DOMINADAS_PARALLEL_HALF, y, DOMINADAS_PARALLEL_Z + 0.1]}
            r={0.02}
            color={m.grip === 'paralelas' ? palette.pad : palette.metal}
            metal={m.grip === 'paralelas' ? 0.1 : 0.3}
          />
        </group>
      ))}
      <Beam from={[-OUTER, TOP, TOWER_Z]} to={[OUTER, TOP, TOWER_Z]} w={0.07} color={f} />
      <Beam from={[-OUTER, y + 0.06, DOMINADAS_PARALLEL_Z]} to={[OUTER, y + 0.06, DOMINADAS_PARALLEL_Z]} w={0.05} color={f} />
      {/* Barra recta con los puños donde se agarra */}
      <Tube from={[-BAR_HALF, y, BAR_Z]} to={[BAR_HALF, y, BAR_Z]} r={0.016} color={palette.metal} />
      {m.grip === 'barra' &&
        (['L', 'R'] as const).map((side) => (
          <Tube
            key={side}
            from={m.grips[side].clone().setZ(BAR_Z).add(new Vector3(-0.06, 0, 0))}
            to={m.grips[side].clone().setZ(BAR_Z).add(new Vector3(0.06, 0, 0))}
            r={0.019}
            color={palette.pad}
            metal={0.1}
          />
        ))}

      {/* Asistencia: rodillera unida al contrapeso de la torre */}
      <WeightStack base={STACK} plates={14} selected={Math.round(m.assistKg / 5)} lift={m.stackLift} palette={palette} />
      {m.kneePad && (
        <group>
          <Pad position={m.kneePad} size={[0.42, 0.06, 0.3]} color={palette.pad} />
          <Beam from={m.kneePad.clone().add(new Vector3(0, -0.03, 0.12))} to={[0, m.kneePad.y - 0.03, TOWER_Z]} w={0.05} color={f} />
          <Cable points={[new Vector3(0, m.kneePad.y - 0.03, TOWER_Z), new Vector3(0, stackTop + 0.04 + m.stackLift, STACK.z)]} color={palette.cable} />
        </group>
      )}

      {/* Lastre: cinturón con cadena y discos */}
      {m.belt && (
        <group>
          <Tube from={m.belt} to={m.belt.clone().add(new Vector3(0, -0.28, 0.06))} r={0.006} color={palette.metal} />
          <Disc position={m.belt.clone().add(new Vector3(0, -0.32, 0.06))} axis={Z} radius={m.ballastKg >= 20 ? 0.2 : 0.14} thickness={0.04} color={m.ballastKg >= 20 ? '#1b6ac9' : '#2e9e5b'} />
        </group>
      )}
    </group>
  );
}
