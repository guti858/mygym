import { ThreeCanvas } from '@remotion/three';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeSegments } from '../engine/anthropometry';
import { evaluateFrame } from '../engine/evaluate';
import { Avatar, jointStatuses } from '../scene/Avatar';
import { CameraRig } from '../scene/CameraRig';
import { boxCorners, fitCamera, keyLightFor, project } from '../scene/camera';
import { Lights } from '../scene/Environment';
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
      <Avatar body={r.body} palette={palette} statuses={jointStatuses([])} muscles={variant.muscles} activation={0.8} showMuscles pulse={0} />
    </group>
  );
}

export const HubComposition: React.FC<HubCompProps> = (props) => {
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

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg, fontFamily: props.theme === 'terminal' ? MONO : SANS }}>
      <ThreeCanvas width={width} height={height} orthographic shadows frameloop="demand">
        <color attach="background" args={[palette.bg]} />
        <CameraRig spec={cam} />
        <Lights extent={12} keyPosition={keyLightFor(cam)} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[FLOOR[0], FLOOR[1]]} />
          <meshStandardMaterial color={palette.floor} roughness={0.95} />
        </mesh>
        <gridHelper args={[19, 38, palette.floorLine, palette.floorLine]} position={[0, 0.003, 0]} />
        {(Object.keys(ZONES) as Zone[]).map((z) => {
          const zr = ZONES[z];
          return (
            <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[zr.x, 0.006, zr.z]} receiveShadow>
              <planeGeometry args={[zr.w, zr.d]} />
              <meshStandardMaterial color={palette.zone[z]} roughness={0.9} transparent opacity={0.85} />
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
        const zr = ZONES[z];
        const [x, y] = project(cam, new Vector3(zr.x - zr.w / 2 + 0.6, 0, zr.z + zr.d / 2 - 0.4));
        return (
          <div
            key={z}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              color: palette.label,
              opacity: 0.55,
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
        const [x, y] = project(cam, new Vector3(entry.hub.x, 2.55, entry.hub.z));
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
