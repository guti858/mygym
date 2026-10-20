import { ThreeCanvas } from '@remotion/three';
import { useAnatomy } from '../anatomy/useAnatomy';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeSegments } from '../engine/anthropometry';
import { evaluateFrame } from '../engine/evaluate';
import { Avatar, jointStatuses } from '../scene/Avatar';
import { CameraRig } from '../scene/CameraRig';
import { boxCorners, fitCamera, keyLightFor, project } from '../scene/camera';
import { Lights } from '../scene/Environment';
import { GymRoom, RoomLighting } from '../scene/GymRoom';
import { Mat } from '../scene/kit';
import { PALETTES } from '../scene/palette';
import { Placeholder } from '../scene/Placeholder';
import { CATALOG, ZONE_LABEL, type CatalogEntry, type Zone } from '../stations/catalog';
import { getModule } from '../stations/modules';
import type { HubCompProps } from './props';
import { MONO, SANS } from './StationComposition';

const FLOOR: readonly [number, number] = [19, 13];
const ZONES: Record<Zone, { x: number; z: number; w: number; d: number }> = {
  traccion: { x: -4.75, z: -3.9, w: 9.3, d: 5.0 },
  brazos: { x: 1.4, z: -3.9, w: 2.9, d: 5.0 },
  pierna: { x: 6.15, z: -2.4, w: 6.5, d: 8.0 },
  empuje: { x: -3.35, z: 2.6, w: 12.1, d: 7.6 },
  libre: { x: 6.15, z: 4.7, w: 6.5, d: 3.4 },
};

type Rect = { x0: number; y0: number; x1: number; y1: number };
/** Distancia entre dos rectángulos de pantalla; negativa si se solapan (cuanto más, más negativa). */
function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
  return dx < 0 && dy < 0 ? Math.max(dx, dy) : Math.hypot(Math.max(0, dx), Math.max(0, dy));
}

function ActiveStation({ entry, t, props }: { entry: CatalogEntry; t: number; props: HubCompProps }) {
  const mod = getModule(entry.id)!;
  const palette = PALETTES[props.theme];
  const seg = useMemo(() => computeSegments(props.anthro), [props.anthro]);
  const variant = mod.content.variants[0]!;
  const p = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 4);
  const r = evaluateFrame(mod.logic, mod.content, {
    anthro: props.anthro,
    seg,
    variantId: variant.id,
    errorId: null,
    loadKg: mod.logic.defaultLoadKg,
    p,
    phase: 'concentrica',
  });
  return (
    <group>
      <mod.Machine m={r.machine} palette={palette} H={seg.H} />
      <Avatar body={r.body} palette={palette} statuses={jointStatuses([])} muscles={variant.muscles} activation={0.8} showMuscles pulse={0} castShadow={false} />
    </group>
  );
}

export const HubComposition: React.FC<HubCompProps> = (props) => {
  // Fuera del lienzo 3D: aquí sí llega el contexto de Remotion (espera al modelo al renderizar).
  useAnatomy();
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const palette = PALETTES[props.theme];
  const t = frame / fps;
  const cam = fitCamera({
    azimuth: -45 + 90 * props.rotation,
    elevation: 35.264,
    points: boxCorners([-FLOOR[0] / 2, 0, -FLOOR[1] / 2], [FLOOR[0] / 2, 1.2, FLOOR[1] / 2]),
    width,
    height,
    margins: { top: 0.06, bottom: 0.02, side: 0.02 },
    zoomFactor: props.zoom,
  });
  const unit = (Math.min(width, height) / 900) * (props.uiScale ?? 1);
  // Rótulo de cada estación justo encima de su máquina (a altura fija, el de una máquina baja
  // flotaría sobre la de detrás).
  const labelY = (e: CatalogEntry) => Math.min(2.55, (getModule(e.id)?.logic.bounds.max[1] ?? 2.2) + 0.35);
  // Rótulos de zona: entre una rejilla de puntos del suelo de cada zona, el que deja el rótulo más
  // lejos (en pantalla) de las máquinas, de sus rótulos y de los rótulos de zona ya colocados.
  // Así ninguno se monta sobre otro, con cualquier giro de la sala.
  const occupied: Rect[] = CATALOG.flatMap((e) => {
    const [bx, by] = project(cam, new Vector3(e.hub.x, 0, e.hub.z));
    const [lx, ly] = project(cam, new Vector3(e.hub.x, labelY(e), e.hub.z));
    const lw = (e.short.length * 0.56 * 17 + 18) * unit;
    return [
      { x0: Math.min(bx, lx) - 40 * unit, x1: Math.max(bx, lx) + 40 * unit, y0: Math.min(by, ly), y1: Math.max(by, ly) + 10 * unit },
      { x0: lx - lw / 2, x1: lx + lw / 2, y0: ly - 30 * unit, y1: ly },
    ];
  });
  const zoneLabelAt = {} as Record<Zone, [number, number]>;
  for (const z of Object.keys(ZONES) as Zone[]) {
    const zr = ZONES[z];
    const w = ZONE_LABEL[z].length * (0.68 * 15 * unit + 2);
    const h = 18 * unit;
    let best: [number, number] = [0, 0];
    let bestScore = -Infinity;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const [cx, cy] = project(cam, new Vector3(zr.x + (i / 2 - 1) * (zr.w / 2 - 0.5), 0, zr.z + (j / 2 - 1) * (zr.d / 2 - 0.4)));
        const r: Rect = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
        const inside = r.x0 > 0 && r.x1 < width && r.y0 > 0 && r.y1 < height;
        const score = (inside ? 0 : -1e6) + Math.min(...occupied.map((o) => rectGap(r, o)));
        if (score > bestScore) {
          bestScore = score;
          best = [cx, cy];
        }
      }
    }
    zoneLabelAt[z] = best;
    occupied.push({ x0: best[0] - w / 2, x1: best[0] + w / 2, y0: best[1] - h / 2, y1: best[1] + h / 2 });
  }

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg, fontFamily: props.theme === 'terminal' ? MONO : SANS }}>
      <ThreeCanvas width={width} height={height} dpr={1} orthographic shadows frameloop="demand">
        <color attach="background" args={[palette.bg]} />
        <CameraRig spec={cam} />
        <Lights extent={12} keyPosition={keyLightFor(cam)} />
        <RoomLighting />
        <GymRoom palette={palette} center={[0, 0]} size={FLOOR} azimuth={-45 + 90 * props.rotation} elevation={35.264} height={2.6} variant="hub" />
        {(Object.keys(ZONES) as Zone[]).map((z) => {
          const zr = ZONES[z];
          return (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[zr.x, 0.006, zr.z]} receiveShadow>
              <planeGeometry args={[zr.w, zr.d]} />
              <meshStandardMaterial color={palette.zone[z]} roughness={0.9} transparent opacity={0.72} />
            </mesh>
          );
        })}
        {CATALOG.map((entry) => {
          const mod = getModule(entry.id);
          const hl = props.highlight[entry.id];
          const hovered = props.hovered === entry.id;
          const ring = hovered ? palette.accent : hl === 'principal' ? palette.muscle.principal : hl === 'secundario' ? palette.muscle.sinergista : null;
          const bb = mod?.logic.bounds;
          const center: [number, number, number] = bb ? [(bb.min[0] + bb.max[0]) / 2, 0, (bb.min[2] + bb.max[2]) / 2] : [0, 0, 0];
          return (
            <group
              key={entry.id}
              position={[entry.hub.x, 0, entry.hub.z]}
              rotation={[0, entry.hub.yaw, 0]}
              onClick={(e) => {
                e.stopPropagation();
                props.onSelect?.(entry.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                props.onHover?.(entry.id);
              }}
              onPointerOut={() => props.onHover?.(null)}
            >
              {ring && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
                  <ringGeometry args={[1.25, 1.42, 48]} />
                  <Mat color={ring} emissive={ring} emissiveIntensity={0.6} />
                </mesh>
              )}
              <mesh position={[0, 1.2, 0]}>
                <boxGeometry args={[2.4, 2.4, 2.4]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
              <group position={[-center[0], 0, -center[2]]}>
                {mod ? <ActiveStation entry={entry} t={t} props={props} /> : <Placeholder kind={entry.placeholder} palette={palette} />}
              </group>
            </group>
          );
        })}
      </ThreeCanvas>

      {(Object.keys(ZONES) as Zone[]).map((z) => {
        const [x, y] = zoneLabelAt[z];
        return (
          <div
            key={z}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              color: palette.label,
              opacity: 0.75,
              textShadow: `0 0 ${4 * unit}px ${palette.bg}, 0 0 ${2 * unit}px ${palette.bg}`,
              translate: '-50% -50%',
              whiteSpace: 'nowrap',
              fontSize: 15 * unit,
              fontWeight: 800,
              letterSpacing: 2,
              textTransform: 'uppercase',
              pointerEvents: 'none',
            }}
          >
            {ZONE_LABEL[z]}
          </div>
        );
      })}

      {CATALOG.map((entry) => {
        const [x, y] = project(cam, new Vector3(entry.hub.x, labelY(entry), entry.hub.z));
        const hovered = props.hovered === entry.id;
        const hl = props.highlight[entry.id];
        return (
          <div
            key={entry.id}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              translate: '-50% -100%',
              background: palette.labelBg,
              color: palette.label,
              border: `${1.5 * unit}px solid ${hovered ? palette.accent : hl === 'principal' ? palette.muscle.principal : hl === 'secundario' ? palette.muscle.sinergista : 'transparent'}`,
              borderRadius: 10 * unit,
              padding: `${4 * unit}px ${9 * unit}px`,
              fontSize: 17 * unit,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              opacity: entry.ready || hovered ? 1 : 0.72,
            }}
          >
            {!entry.ready && <span style={{ opacity: 0.6 }}>○ </span>}
            {entry.short}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
