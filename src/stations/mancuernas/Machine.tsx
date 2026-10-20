import { Vector3 } from 'three';
import { Beam, Disc, FootPlate, Pad, Tube } from '../../scene/kit';
import type { ScenePalette } from '../../scene/palette';
import { qAxis } from '../../engine/math';
import type { BenchPose, Dumbbell, MancuernasMachine } from './logic';

const X = new Vector3(1, 0, 0);
const HANDLE = 0.13;

/** Tamaño de la cabeza de una mancuerna según su peso. */
const headSize = (kg: number) => ({ r: 0.045 + 0.0018 * kg, len: 0.045 + 0.0016 * kg });

function DumbbellMesh({ d, kg, palette }: { d: Dumbbell; kg: number; palette: ScenePalette }) {
  const { r, len } = headSize(kg);
  const off = HANDLE / 2 + len / 2;
  return (
    <group>
      <Tube from={d.center.clone().add(d.axis.clone().multiplyScalar(-HANDLE / 2))} to={d.center.clone().add(d.axis.clone().multiplyScalar(HANDLE / 2))} r={0.014} color={palette.metal} />
      {[-1, 1].map((s) => (
        <Disc key={s} position={d.center.clone().add(d.axis.clone().multiplyScalar(s * off))} axis={d.axis} radius={r} thickness={len} color={palette.frameDark} metal={0.3} />
      ))}
    </group>
  );
}

/** Banco regulable (asiento + respaldo sobre el plano donde apoya la espalda) o banco plano. */
function Bench({ b, palette }: { b: BenchPose; palette: ScenePalette }) {
  const f = palette.frame;
  if (!b.back) {
    const half = b.length / 2;
    return (
      <group>
        <Pad position={[b.x, b.top - 0.035, b.z]} size={[0.3, 0.07, b.length]} color={palette.pad} />
        <Beam from={[b.x, b.top - 0.08, b.z - half + 0.08]} to={[b.x, b.top - 0.08, b.z + half - 0.08]} w={0.06} color={f} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <Beam from={[b.x, 0.02, b.z + s * (half - 0.1)]} to={[b.x, b.top - 0.08, b.z + s * (half - 0.1)]} w={0.06} color={f} />
            <Beam from={[b.x - 0.18, 0.02, b.z + s * (half - 0.1)]} to={[b.x + 0.18, 0.02, b.z + s * (half - 0.1)]} w={0.06} color={f} />
          </group>
        ))}
      </group>
    );
  }
  const r = (b.back.recline * Math.PI) / 180;
  const along = new Vector3(0, Math.cos(r), -Math.sin(r));
  const normal = new Vector3(0, Math.sin(r), Math.cos(r));
  const point = new Vector3(0, b.back.y, b.back.z);
  const L = 0.78;
  const t = (b.top + 0.04 - point.y) / along.y;
  const low = point.clone().add(along.clone().multiplyScalar(t));
  const center = low.clone().add(along.clone().multiplyScalar(L / 2)).sub(normal.clone().multiplyScalar(0.035));
  const support = low.clone().add(along.clone().multiplyScalar(L * 0.55)).sub(normal.clone().multiplyScalar(0.08));
  return (
    <group>
      <Pad position={[b.x, b.top - 0.035, b.z]} size={[0.32, 0.07, b.length]} color={palette.pad} />
      <Pad position={center} quaternion={qAxis(X, -b.back.recline)} size={[0.3, L, 0.07]} color={palette.pad} />
      <Beam from={[0, 0.03, b.z - 0.45]} to={[0, 0.03, b.z + 0.35]} w={0.07} color={f} />
      <Beam from={[0, 0.03, b.z]} to={[0, b.top - 0.07, b.z]} w={0.06} color={f} />
      <Beam from={[0, 0.03, low.z - 0.05]} to={support} w={0.05} color={f} />
      <Beam from={[-0.2, 0.03, b.z + 0.35]} to={[0.2, 0.03, b.z + 0.35]} w={0.06} color={f} />
      <Beam from={[-0.2, 0.03, b.z - 0.45]} to={[0.2, 0.03, b.z - 0.45]} w={0.06} color={f} />
    </group>
  );
}

/** Rack de dos alturas con pares de mancuernas, detrás del usuario. */
function Rack({ palette }: { palette: ScenePalette }) {
  const f = palette.frame;
  const z = -0.95;
  const kgs = [4, 8, 12, 16, 20, 24];
  return (
    <group>
      {[-0.75, 0.75].map((x) => (
        <Beam key={x} from={[x, 0, z]} to={[x, 0.86, z - 0.12]} w={0.06} color={f} />
      ))}
      {[0.42, 0.8].map((y, row) => (
        <group key={y}>
          <Beam from={[-0.78, y, z - row * 0.1]} to={[0.78, y, z - row * 0.1]} w={0.05} color={f} />
          {kgs.map((kg, i) => {
            const x = -0.62 + i * 0.25;
            const k = kg + row * 14;
            const { r } = headSize(k);
            return (
              <group key={kg}>
                {[-0.05, 0.05].map((dx) => (
                  <DumbbellMesh key={dx} d={{ center: new Vector3(x + dx, y + r + 0.025, z - row * 0.1), axis: new Vector3(0, 0, 1) }} kg={k} palette={palette} />
                ))}
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}

export function MancuernasMachine3D({ m, palette }: { m: MancuernasMachine; palette: ScenePalette }) {
  return (
    <group>
      <FootPlate position={[0, 0, 0]} size={[1.3, 1.3]} color={palette.frameDark} />
      <Rack palette={palette} />
      {m.bench && <Bench b={m.bench} palette={palette} />}
      {m.dumbbells.map((d, i) => (
        <DumbbellMesh key={i} d={d} kg={m.kg} palette={palette} />
      ))}
    </group>
  );
}
