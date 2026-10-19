import type { PlaceholderKind } from '../stations/catalog';
import { Beam, Disc, Pad, Tube } from './kit';
import type { ScenePalette } from './palette';
import { Vector3 } from 'three';

const X = new Vector3(1, 0, 0);

/** Siluetas de las estaciones aún no implementadas (mismo kit, sin avatar). */
export function Placeholder({ kind, palette }: { kind: PlaceholderKind; palette: ScenePalette }) {
  const f = palette.frame;
  const pad = palette.frameDark;
  switch (kind) {
    case 'torre':
      return (
        <group>
          <Beam from={[-0.5, 0, 0]} to={[-0.5, 2.3, 0]} w={0.08} color={f} />
          <Beam from={[0.5, 0, 0]} to={[0.5, 2.3, 0]} w={0.08} color={f} />
          <Beam from={[-0.6, 2.25, 0.1]} to={[0.6, 2.25, 0.1]} w={0.05} color={palette.metal} />
          <Beam from={[-0.5, 1.25, 0]} to={[-0.25, 1.25, 0.45]} w={0.05} color={f} />
          <Beam from={[0.5, 1.25, 0]} to={[0.25, 1.25, 0.45]} w={0.05} color={f} />
          <Pad position={[0, 1.0, -0.05]} size={[0.4, 0.5, 0.08]} color={pad} />
          <Beam from={[-0.5, 0.05, -0.4]} to={[-0.5, 0.05, 0.6]} w={0.06} color={f} />
          <Beam from={[0.5, 0.05, -0.4]} to={[0.5, 0.05, 0.6]} w={0.06} color={f} />
        </group>
      );
    case 'banco':
      return (
        <group>
          <Pad position={[0, 0.43, 0.1]} size={[0.3, 0.07, 1.2]} color={pad} />
          <Beam from={[0, 0, 0.6]} to={[0, 0.4, 0.6]} w={0.06} color={f} />
          <Beam from={[0, 0, -0.4]} to={[0, 0.4, -0.4]} w={0.06} color={f} />
          <Beam from={[-0.55, 0, -0.45]} to={[-0.55, 1.2, -0.45]} w={0.07} color={f} />
          <Beam from={[0.55, 0, -0.45]} to={[0.55, 1.2, -0.45]} w={0.07} color={f} />
          <Tube from={[-1.1, 1.05, -0.4]} to={[1.1, 1.05, -0.4]} r={0.014} color={palette.metal} />
          <Disc position={[-0.95, 1.05, -0.4]} axis={X} radius={0.225} thickness={0.05} color="#1b6ac9" />
          <Disc position={[0.95, 1.05, -0.4]} axis={X} radius={0.225} thickness={0.05} color="#1b6ac9" />
        </group>
      );
    case 'poleas':
      return (
        <group>
          {[-0.9, 0.9].map((x) => (
            <group key={x}>
              <Beam from={[x, 0, 0]} to={[x, 2.3, 0]} w={0.09} color={f} />
              <Pad position={[x, 0.8, -0.08]} size={[0.3, 0.9, 0.12]} color={palette.frame} />
            </group>
          ))}
          <Beam from={[-0.95, 2.3, 0]} to={[0.95, 2.3, 0]} w={0.08} color={f} />
          <Tube from={[-0.9, 1.6, 0.1]} to={[-0.6, 1.4, 0.3]} r={0.004} color={palette.cable} />
          <Tube from={[0.9, 1.6, 0.1]} to={[0.6, 1.4, 0.3]} r={0.004} color={palette.cable} />
        </group>
      );
    case 'remo':
      return (
        <group>
          <Beam from={[0, 0.03, -0.6]} to={[0, 0.03, 0.9]} w={0.07} color={f} />
          <Tube from={[0, 0.1, -0.6]} to={[0, 0.55, 0.7]} r={0.025} color={palette.metal} />
          <Disc position={[0, 0.55, 0.78]} axis={new Vector3(0, 0.33, 0.94)} radius={0.225} thickness={0.05} color="#d7263d" />
          <Pad position={[0, 0.85, 0.05]} quaternion={undefined} size={[0.32, 0.08, 0.5]} color={pad} />
          <Beam from={[0, 0.03, 0.05]} to={[0, 0.8, 0.05]} w={0.06} color={f} />
        </group>
      );
    case 'rack':
      return (
        <group>
          {[0.45, 0.85].map((y, row) => (
            <group key={y}>
              <Beam from={[-1.0, y, -0.1 + row * 0.18]} to={[1.0, y, -0.1 + row * 0.18]} w={0.05} color={f} />
              {Array.from({ length: 7 }, (_, i) => {
                const x = -0.9 + i * 0.3;
                const r = 0.05 + i * 0.006;
                return (
                  <group key={i}>
                    <Tube from={[x - 0.12, y + 0.06, -0.1 + row * 0.18]} to={[x + 0.12, y + 0.06, -0.1 + row * 0.18]} r={0.012} color={palette.metal} />
                    <Disc position={[x - 0.1, y + 0.06, -0.1 + row * 0.18]} axis={X} radius={r} thickness={0.04} color={palette.frame} />
                    <Disc position={[x + 0.1, y + 0.06, -0.1 + row * 0.18]} axis={X} radius={r} thickness={0.04} color={palette.frame} />
                  </group>
                );
              })}
            </group>
          ))}
          {[-1.0, 1.0].map((x) => (
            <Beam key={x} from={[x, 0, 0]} to={[x, 0.9, 0]} w={0.06} color={f} />
          ))}
          <Pad position={[0, 0.43, 1.0]} size={[0.3, 0.07, 1.0]} color={pad} />
        </group>
      );
    case 'pila':
    default:
      return (
        <group>
          <Beam from={[-0.2, 0, -0.55]} to={[-0.2, 1.9, -0.55]} w={0.07} color={f} />
          <Beam from={[0.2, 0, -0.55]} to={[0.2, 1.9, -0.55]} w={0.07} color={f} />
          <Pad position={[0, 0.6, -0.55]} size={[0.3, 0.8, 0.16]} color={palette.frame} />
          <Beam from={[0, 0.03, -0.55]} to={[0, 0.03, 0.55]} w={0.07} color={f} />
          <Pad position={[0, 0.45, 0.25]} size={[0.38, 0.07, 0.36]} color={pad} />
          <Pad position={[0, 0.85, 0.03]} size={[0.36, 0.6, 0.07]} color={pad} />
          <Beam from={[0, 0.03, 0.25]} to={[0, 0.42, 0.25]} w={0.06} color={f} />
          <Beam from={[-0.2, 1.9, -0.55]} to={[-0.35, 1.2, 0.35]} w={0.05} color={f} />
          <Beam from={[0.2, 1.9, -0.55]} to={[0.35, 1.2, 0.35]} w={0.05} color={f} />
        </group>
      );
  }
}
