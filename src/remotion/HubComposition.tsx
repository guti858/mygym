import { ThreeCanvas } from '@remotion/three';
import { useAnatomy } from '../anatomy/useAnatomy';
import { memo, useMemo, useState } from 'react';
import { Vector3 } from 'three';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { computeSegments, type Anthropometry } from '../engine/anthropometry';
import { evaluateFrame } from '../engine/evaluate';
import { Avatar, jointStatuses } from '../scene/Avatar';
import { CameraRig } from '../scene/CameraRig';
import { keyLightFor, project } from '../scene/camera';
import { HUB_HOME, hubCamera, hubMargins, labelLevel, type HubView } from '../scene/hubCamera';
import { Lights } from '../scene/Environment';
import { GymRoom, RoomLighting } from '../scene/GymRoom';
import { BakedRoom } from '../scene/env/BakedRoom';
import { useEnvironment } from '../scene/env/useEnvironment';
import { Repaint, tuneRenderer } from '../scene/Repaint';
import { HUB_AREAS, HUB_FLOOR, HUB_HEIGHT, HUB_ROUTE, HUB_ZONES } from '../scene/layout';
import { Mat } from '../scene/kit';
import { AMBIENT_LIGHT, PALETTES, withAmbient, type ThemeId } from '../scene/palette';
import { Placeholder } from '../scene/Placeholder';
import { MUSCLES } from '../content/muscles';
import { CATALOG, ZONE_LABEL, type CatalogEntry, type Zone } from '../stations/catalog';
import { hubCorners, hubFootprint, hubLabelY, hubPoint } from '../stations/hubPlacement';
import { getModule } from '../stations/modules';
import type { HubCompProps } from './props';
import { MONO, SANS } from './StationComposition';

const FLOOR = HUB_FLOOR;
const ZONES = HUB_ZONES;

/**
 * Rótulos de suelo: las zonas y las áreas sin estación, numeradas en el orden del recorrido docente
 * (calentar en el cardio, empuje, tracción, brazos, pierna, estirar en la zona libre).
 */
const ROUTE_STEP = new Map<string, number>(HUB_ROUTE.map((r, i) => [r.id, i + 1]));
const numbered = (id: string, label: string) => (ROUTE_STEP.has(id) ? `${ROUTE_STEP.get(id)} · ${label}` : label);
const LABEL_REGIONS: { key: string; text: string; rect: { x: number; z: number; w: number; d: number } }[] = [
  ...(Object.keys(ZONES) as Zone[]).map((z) => ({ key: z, text: numbered(z, ZONE_LABEL[z]), rect: ZONES[z] })),
  ...HUB_AREAS.map((a) => ({ key: a.id, text: numbered(a.id, a.label), rect: a })),
];

type Rect = { x0: number; y0: number; x1: number; y1: number };
/** Distancia entre dos rectángulos de pantalla; negativa si se solapan (cuanto más, más negativa). */
function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1);
  const dy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
  return dx < 0 && dy < 0 ? Math.max(dx, dy) : Math.hypot(Math.max(0, dx), Math.max(0, dy));
}

/**
 * Máquina con su avatar en el plano. Memoizada y animada a 15 fps (la mitad que el resto): en los
 * fotogramas intermedios ni React ni la GPU repiten el trabajo de las 12 máquinas.
 */
const ActiveStation = memo(function ActiveStation({ entry, t, theme, anthro }: { entry: CatalogEntry; t: number; theme: ThemeId; anthro: Anthropometry }) {
  const mod = getModule(entry.id)!;
  const palette = PALETTES[theme];
  const seg = useMemo(() => computeSegments(anthro), [anthro]);
  const variant = mod.content.variants[0]!;
  const p = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 4);
  const r = evaluateFrame(mod.logic, mod.content, {
    anthro,
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
      <Avatar sex={anthro.sex} body={r.body} palette={palette} statuses={jointStatuses([])} muscles={variant.muscles} activation={0.8} showMuscles pulse={0} castShadow={false} />
    </group>
  );
});

export const HubComposition: React.FC<HubCompProps> = (props) => {
  // Fuera del lienzo 3D: aquí sí llega el contexto de Remotion (espera al modelo al renderizar).
  const anatomy = useAnatomy(props.anthro.sex);
  const env = useEnvironment();
  // Si la sala llega con el plano ya a la vista, se prepara antes de sustituir a la procedural.
  const [envAtMount] = useState(() => env !== null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const palette = PALETTES[props.theme];
  // Las máquinas del plano se animan a 15 fps (ver ActiveStation).
  const tStations = (Math.floor(frame / 2) * 2) / fps;
  const view: HubView = props.view ?? { ...HUB_HOME, azimuth: -45 + 90 * props.rotation, zoom: props.zoom };
  const { azimuth } = view;
  const cam = hubCamera(view, { width, height }, hubMargins(props.embedded));
  const unit = (Math.min(width, height) / 900) * (props.uiScale ?? 1);
  // Rótulos según el zoom: de lejos, zonas y nombres; más cerca, también el músculo principal; muy
  // cerca, sin zonas (ya no caben y la máquina se reconoce).
  const level = labelLevel(view.zoom);
  const showLabels = props.showLabels ?? true;
  const showZones = (props.showZones ?? true) && level < 2;
  // Selección o acercamiento: esa máquina se destaca y el resto se atenúa.
  const dim = props.focus ?? props.selected ?? null;
  // Rótulos de zona: entre una rejilla de puntos del suelo de cada zona, el que deja el rótulo más
  // lejos (en pantalla) de las máquinas, de sus rótulos y de los rótulos de zona ya colocados.
  // Así ninguno se monta sobre otro, con cualquier giro de la sala.
  const occupied: Rect[] = CATALOG.flatMap((e) => {
    const [bx, by] = project(cam, hubPoint(e, 0));
    const [lx, ly] = project(cam, hubPoint(e, hubLabelY(e)));
    const lw = (e.short.length * 0.56 * 17 + 18) * unit;
    return [
      { x0: Math.min(bx, lx) - 40 * unit, x1: Math.max(bx, lx) + 40 * unit, y0: Math.min(by, ly), y1: Math.max(by, ly) + 10 * unit },
      { x0: lx - lw / 2, x1: lx + lw / 2, y0: ly - (level ? 48 : 30) * unit, y1: ly },
    ];
  });
  const zoneLabelAt: { key: string; text: string; at: [number, number] }[] = [];
  for (const region of showZones ? LABEL_REGIONS : []) {
    const zr = region.rect;
    const w = region.text.length * (0.68 * 15 * unit + 2);
    const h = 18 * unit;
    let best: [number, number] = [0, 0];
    let bestScore = -Infinity;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const [cx, cy] = project(cam, new Vector3(zr.x + (i / 2 - 1) * Math.max(0, zr.w / 2 - 0.5), 0, zr.z + (j / 2 - 1) * Math.max(0, zr.d / 2 - 0.4)));
        const r: Rect = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
        const inside = r.x0 > 0 && r.x1 < width && r.y0 > 0 && r.y1 < height;
        const score = (inside ? 0 : -1e6) + Math.min(...occupied.map((o) => rectGap(r, o)));
        if (score > bestScore) {
          bestScore = score;
          best = [cx, cy];
        }
      }
    }
    zoneLabelAt.push({ key: region.key, text: region.text, at: best });
    occupied.push({ x0: best[0] - w / 2, x1: best[0] + w / 2, y0: best[1] - h / 2, y1: best[1] + h / 2 });
  }

  // Viñeta sobre la máquina elegida: lo de alrededor se atenúa (más al acercarse para abrirla).
  const veil = (() => {
    const entry = dim ? CATALOG.find((c) => c.id === dim) : undefined;
    if (!entry) return null;
    const pts = hubCorners(entry).map((p) => project(cam, p));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const r = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 0.55 + 24 * unit;
    return { cx, cy, r, alpha: props.focus ? 'b3' : '73' };
  })();

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg, fontFamily: props.theme === 'terminal' ? MONO : SANS }}>
      {/* preserveDrawingBuffer: la transición a una estación copia el plano (src/ui/zoomTransition.ts). */}
      <ThreeCanvas
        width={width}
        height={height}
        dpr={props.dpr ?? 1}
        orthographic
        shadows
        frameloop="demand"
        gl={{ preserveDrawingBuffer: true }}
        onCreated={tuneRenderer}
        onPointerMissed={() => props.onMiss?.()}
      >
        <color attach="background" args={[palette.bg]} />
        <CameraRig spec={cam} />
        <Lights extent={12} keyPosition={keyLightFor(cam)} shadowPosition={env ? [4, 12, 2.5] : undefined} />
        <RoomLighting />
        {(() => {
          // Sala procedural con el suelo de cada zona pintado encima (la horneada ya lo trae).
          const procedural = (
            <>
              <GymRoom palette={palette} center={[0, 0]} size={FLOOR} azimuth={azimuth} elevation={view.elevation} height={HUB_HEIGHT} variant="hub" />
              {(Object.keys(ZONES) as Zone[]).map((z) => {
                const zr = ZONES[z];
                return (
                  <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[zr.x, 0.006, zr.z]} receiveShadow>
                    <planeGeometry args={[zr.w, zr.d]} />
                    <meshStandardMaterial color={palette.zone[z]} roughness={0.9} transparent opacity={0.72} />
                  </mesh>
                );
              })}
            </>
          );
          return env ? (
            <BakedRoom
              asset={env.rooms.hub}
              palette={withAmbient(palette, props.ambient ?? 'dia')}
              light={AMBIENT_LIGHT[props.ambient ?? 'dia']}
              azimuth={azimuth}
              floorSize={FLOOR}
              shadowOpacity={0.24}
              warm={!envAtMount}
              fallback={procedural}
            />
          ) : (
            procedural
          );
        })()}
        {CATALOG.map((entry) => {
          const mod = getModule(entry.id);
          const hl = props.highlight[entry.id];
          const hovered = props.hovered === entry.id;
          const chosen = dim === entry.id || props.recent === entry.id;
          const ring = hovered || chosen ? palette.accent : hl === 'principal' ? palette.muscle.principal : hl === 'secundario' ? palette.muscle.sinergista : null;
          const fp = hubFootprint(entry);
          return (
            <group key={entry.id} position={[entry.hub.x, 0, entry.hub.z]} rotation={[0, entry.hub.yaw, 0]}>
              {ring && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
                  <ringGeometry args={chosen ? [1.22, 1.46, 48] : [1.25, 1.42, 48]} />
                  <Mat color={ring} emissive={ring} emissiveIntensity={0.6} />
                </mesh>
              )}
              {/* Caja invisible de selección, del tamaño de la máquina: los eventos solo prueban esta
                  caja, no las mallas de la máquina ni las del avatar (que, con piel animada, cuestan
                  mucho de intersecar). */}
              <mesh
                position={[0, (fp.height + 0.1) / 2, 0]}
                onClick={(e) => {
                  e.stopPropagation();
                  const [sx, sy] = project(cam, hubPoint(entry, 0.9));
                  props.onSelect?.(entry.id, { x: sx / width, y: sy / height });
                }}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  props.onHover?.(entry.id);
                }}
                onPointerOut={() => props.onHover?.(null)}
              >
                <boxGeometry args={[Math.max(0.9, 2 * fp.half[0] + 0.2), fp.height + 0.1, Math.max(0.9, 2 * fp.half[1] + 0.2)]} />
                <meshBasicMaterial visible={false} />
              </mesh>
              <group position={[-fp.center[0], 0, -fp.center[1]]}>
                {mod ? <ActiveStation entry={entry} t={tStations} theme={props.theme} anthro={props.anthro} /> : <Placeholder kind={entry.placeholder} palette={palette} />}
              </group>
            </group>
          );
        })}
        <Repaint ready={[env, anatomy]} />
      </ThreeCanvas>

      {veil && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(circle at ${veil.cx}px ${veil.cy}px, transparent ${veil.r}px, ${palette.bg}${veil.alpha} ${veil.r * 1.7}px)`,
          }}
        />
      )}

      {zoneLabelAt.map(({ key, text, at: [x, y] }) => (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: x,
            top: y,
            color: palette.label,
            opacity: dim ? 0.4 : 0.75,
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
          {text}
        </div>
      ))}

      {CATALOG.map((entry) => {
        const hovered = props.hovered === entry.id;
        const chosen = dim === entry.id || props.recent === entry.id;
        if (!showLabels && !hovered && !chosen) return null;
        const [x, y] = project(cam, hubPoint(entry, hubLabelY(entry)));
        const hl = props.highlight[entry.id];
        const principal = entry.principal.map((m) => MUSCLES[m].name).join(', ');
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
              border: `${1.5 * unit}px solid ${hovered || chosen ? palette.accent : hl === 'principal' ? palette.muscle.principal : hl === 'secundario' ? palette.muscle.sinergista : 'transparent'}`,
              borderRadius: 10 * unit,
              padding: `${4 * unit}px ${9 * unit}px`,
              fontSize: 17 * unit,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              textAlign: 'center',
              pointerEvents: 'none',
              opacity: dim && !chosen ? 0.45 : entry.ready || hovered ? 1 : 0.72,
            }}
          >
            {!entry.ready && <span style={{ opacity: 0.6 }}>○ </span>}
            {entry.short}
            {level > 0 && <div style={{ fontSize: 12.5 * unit, fontWeight: 500, opacity: 0.75 }}>{principal}</div>}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
