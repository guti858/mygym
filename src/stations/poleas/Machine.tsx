import { Vector3 } from 'three';
import { Beam, Cable, Disc, FootPlate, Pulley, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { POLEA_CARRIAGE_Z, type PoleasMachine } from './logic';

const X = new Vector3(1, 0, 0);
const TOP = 2.24;
const POST_X = 0.17;
const STACK = new Vector3(0, 0.06, 0);

export function PoleasMachine3D({ m, palette }: { m: PoleasMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const side = -m.facing; // signo de z de la cara de la columna donde está el carro
  const railZ = side * 0.07;
  const stackTop = STACK.y + m.stackPlates * 0.032;
  const topPulley = new Vector3(0, TOP - 0.06, side * POLEA_CARRIAGE_Z);
  const handles = m.hands;
  return (
    <group>
      <FootPlate position={[0, 0, 0]} size={[0.62, 0.5]} color={palette.frameDark} />
      {/* Columna: dos postes con la pila entre ellos */}
      {[-1, 1].map((s) => (
        <Beam key={s} from={[s * POST_X, 0, 0]} to={[s * POST_X, TOP, 0]} w={0.07} color={f} />
      ))}
      <Beam from={[-POST_X, TOP, 0]} to={[POST_X, TOP, 0]} w={0.07} color={f} />
      <WeightStack base={STACK} plates={m.stackPlates} selected={m.selectedPlates} lift={m.stackLift} palette={palette} />
      {/* Guía del carro y carro con la polea a la altura elegida */}
      <Tube from={[0, 0.08, railZ]} to={[0, TOP - 0.1, railZ]} r={0.018} color={palette.metal} />
      <Beam from={[-0.05, m.pulley.y, railZ]} to={[0.05, m.pulley.y, railZ]} w={0.07} color={palette.accent} />
      <Pulley position={m.pulley} axis={X} color={palette.metal} hub={palette.accent} />
      <Pulley position={topPulley} axis={X} color={palette.metal} hub={palette.frameDark} />
      <Cable points={[m.hook, m.pulley]} color={palette.cable} />
      <Cable points={[m.pulley.clone().add(new Vector3(0, m.pulley.y > 1 ? 0.06 : -0.06, 0)), topPulley, new Vector3(0, TOP - 0.06, 0), new Vector3(0, stackTop + 0.04 + m.stackLift, 0)]} color={palette.cable} />
      {/* Accesorio */}
      {m.attachment === 'barra' ? (
        <group>
          <Tube from={handles.L.clone().add(new Vector3(0.08, 0, 0))} to={handles.R.clone().add(new Vector3(-0.08, 0, 0))} r={0.014} color={palette.metal} />
          <Disc position={m.hook} axis={X} radius={0.022} thickness={0.04} color={palette.frameDark} />
        </group>
      ) : (
        <group>
          {(['L', 'R'] as const).map((s) => (
            <group key={s}>
              <Tube from={m.hook} to={handles[s]} r={0.011} color={palette.pad} metal={0.05} />
              <Disc position={handles[s].clone().add(handles[s].clone().sub(m.hook).normalize().multiplyScalar(0.06))} axis={handles[s].clone().sub(m.hook).normalize()} radius={0.022} thickness={0.03} color={palette.pad} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
