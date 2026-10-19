import { Vector3 } from 'three';
import { Beam, Cable, FootPlate, Pad, Pulley, Tube, WeightStack } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import type { JalonMachine } from './logic';

const X = new Vector3(1, 0, 0);
const STACK = new Vector3(0, 0.06, 0.88);
const COL_Z = 0.98;

function Bar({ m, palette }: { m: JalonMachine; palette: ScenePalette }) {
  const c = m.bar;
  const hook = c.clone().add(new Vector3(0, 0.07, 0));
  if (m.barKind === 'v') {
    const L = m.hands.L;
    const R = m.hands.R;
    const apex = c.clone().add(new Vector3(0, 0.12, 0));
    return (
      <group>
        <Tube from={apex} to={L} r={0.012} color={palette.metal} />
        <Tube from={apex} to={R} r={0.012} color={palette.metal} />
        <Tube from={L.clone().add(new Vector3(0, -0.01, -0.06))} to={L.clone().add(new Vector3(0, 0.01, 0.06))} r={0.016} color={palette.pad} metal={0.1} />
        <Tube from={R.clone().add(new Vector3(0, -0.01, -0.06))} to={R.clone().add(new Vector3(0, 0.01, 0.06))} r={0.016} color={palette.pad} metal={0.1} />
      </group>
    );
  }
  const half = m.barKind === 'larga' ? 0.42 : 0.4;
  const ends =
    m.barKind === 'larga'
      ? [
          <Tube key="l" from={c.clone().add(X.clone().multiplyScalar(half))} to={c.clone().add(new Vector3(0.62, -0.08, 0))} r={0.013} color={palette.metal} />,
          <Tube key="r" from={c.clone().add(X.clone().multiplyScalar(-half))} to={c.clone().add(new Vector3(-0.62, -0.08, 0))} r={0.013} color={palette.metal} />,
        ]
      : [];
  return (
    <group>
      <Tube from={c.clone().add(X.clone().multiplyScalar(-half))} to={c.clone().add(X.clone().multiplyScalar(half))} r={0.013} color={palette.metal} />
      {ends}
      <Tube from={c} to={hook} r={0.006} color={palette.metal} />
    </group>
  );
}

export function JalonMachine3D({ m, palette }: { m: JalonMachine; palette: ScenePalette }) {
  const f = palette.frame;
  const top = 2.38;
  const stackTop = STACK.y + m.stackPlates * 0.032;
  const cable = [
    m.bar.clone().add(new Vector3(0, 0.07, 0)),
    m.pulleyFront.clone().add(new Vector3(0, -0.06, 0)),
    m.pulleyFront.clone().add(new Vector3(0, 0.06, 0.02)),
    m.pulleyBack.clone().add(new Vector3(0, 0.06, -0.02)),
    m.pulleyBack.clone().add(new Vector3(0, -0.02, 0.06)),
    new Vector3(0, stackTop + 0.04 + m.stackLift, STACK.z),
  ];
  return (
    <group>
      {/* Bastidor */}
      <FootPlate position={[0, 0, 0.35]} size={[0.9, 1.6]} color={palette.frameDark} />
      <Beam from={[-0.22, 0, COL_Z]} to={[-0.22, top, COL_Z]} w={0.07} color={f} />
      <Beam from={[0.22, 0, COL_Z]} to={[0.22, top, COL_Z]} w={0.07} color={f} />
      <Beam from={[-0.26, top, COL_Z]} to={[0.26, top, COL_Z]} w={0.07} color={f} />
      <Beam from={[0, top, COL_Z]} to={[0, top, 0.05]} w={0.08} color={f} />
      <Beam from={[0, 0.05, COL_Z]} to={[0, 0.05, -0.25]} w={0.07} color={f} />
      <Beam from={[-0.3, 0.05, -0.25]} to={[0.3, 0.05, -0.25]} w={0.06} color={f} />

      {/* Poleas y cable */}
      <Pulley position={m.pulleyFront} axis={X} color={palette.frameDark} hub={palette.metal} />
      <Pulley position={m.pulleyBack} axis={X} color={palette.frameDark} hub={palette.metal} />
      <Cable points={cable} color={palette.cable} />

      {/* Pila de placas */}
      <WeightStack base={STACK} plates={m.stackPlates} selected={m.selectedPlates} lift={m.stackLift} palette={palette} />

      {/* Asiento */}
      <Beam from={[0, 0.05, -0.02]} to={[0, m.seatY - 0.06, -0.02]} w={0.06} color={f} />
      <Pad position={[0, m.seatY - 0.035, -0.02]} size={[0.38, 0.07, 0.36]} color={palette.pad} />
      <Tube from={[0.05, m.seatY - 0.2, -0.02]} to={[0.12, m.seatY - 0.2, -0.02]} r={0.012} color={palette.accent} />

      {/* Rodillos de muslos */}
      <Beam from={[0, 0.05, m.padZ + 0.16]} to={[0, m.padY, m.padZ + 0.16]} w={0.05} color={f} />
      <Beam from={[0, m.padY, m.padZ + 0.16]} to={[0, m.padY, m.padZ]} w={0.04} color={f} />
      <Tube from={[-0.3, m.padY, m.padZ]} to={[0.3, m.padY, m.padZ]} r={0.014} color={palette.metal} />
      <Tube from={[0.07, m.padY, m.padZ]} to={[0.27, m.padY, m.padZ]} r={0.05} color={palette.pad} metal={0.05} />
      <Tube from={[-0.07, m.padY, m.padZ]} to={[-0.27, m.padY, m.padZ]} r={0.05} color={palette.pad} metal={0.05} />
      <Tube from={[0.02, m.padY - 0.12, m.padZ + 0.16]} to={[0.08, m.padY - 0.12, m.padZ + 0.16]} r={0.01} color={palette.accent} />

      <Bar m={m} palette={palette} />
    </group>
  );
}
