import { Vector3 } from 'three';
import { Beam, Cable, Disc, FootPlate, Pad, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { barHalfWidthAt, FONDOS_BAR_PATH, type FondosMachine } from './logic';

const Z = new Vector3(0, 0, 1);
const TOWER_Z = -0.55;
const STACK = new Vector3(0, 0.06, -0.72);
const OUTER = 0.36;

export function FondosMachine3D({ m, palette }: { m: FondosMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const y = m.barY;
  const stackTop = STACK.y + 14 * 0.032;
  return (
    <group>
      <FootPlate position={[0, 0, -0.1]} size={[1.0, 1.4]} color={palette.frameDark} />
      {/* Torre y paralelas convergentes: anchas junto a la torre, estrechas delante */}
      {[-1, 1].map((s) => {
        const gz = m.grips.R.z;
        return (
          <group key={s}>
            <Beam from={[s * OUTER, 0, TOWER_Z]} to={[s * OUTER, 2.15, TOWER_Z]} w={0.08} color={f} />
            <Beam from={[s * OUTER, y - 0.04, TOWER_Z]} to={[s * OUTER, y - 0.04, -0.2]} w={0.06} color={f} />
            {FONDOS_BAR_PATH.slice(1).map(([x1, z1], i) => {
              const [x0, z0] = FONDOS_BAR_PATH[i]!;
              return <Tube key={i} from={[s * x0, y, z0]} to={[s * x1, y, z1]} r={0.02} color={palette.metal} />;
            })}
            {/* Puño donde se agarra en esta modalidad */}
            <Tube from={[s * barHalfWidthAt(gz - 0.07), y + 0.02, gz - 0.07]} to={[s * barHalfWidthAt(gz + 0.07), y + 0.02, gz + 0.07]} r={0.022} color={palette.pad} metal={0.1} />
          </group>
        );
      })}
      <Beam from={[-OUTER, 2.12, TOWER_Z]} to={[OUTER, 2.12, TOWER_Z]} w={0.07} color={f} />
      <Pad position={[0, 1.55, TOWER_Z + 0.05]} size={[0.32, 0.4, 0.06]} color={palette.pad} />

      {/* Asistencia: rodillera unida al contrapeso */}
      <WeightStack base={STACK} plates={14} selected={Math.round(m.assistKg / 5)} lift={m.stackLift} palette={palette} />
      {m.kneePad && (
        <group>
          <Pad position={m.kneePad} size={[0.42, 0.06, 0.3]} color={palette.pad} />
          <Beam from={m.kneePad.clone().add(new Vector3(0, -0.03, -0.12))} to={[0, m.kneePad.y - 0.03, TOWER_Z]} w={0.05} color={f} />
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
