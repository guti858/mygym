import { ThreeCanvas } from '@remotion/three';
import { useAnatomy } from '../anatomy/useAnatomy';
import { useMemo, useRef, useState } from 'react';
import { Vector3, type Group } from 'three';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { STATUS_RANK, errorMoment, evaluateFrame } from '../engine/evaluate';
import { loadShort } from '../engine/load';
import { METRIC_INFO } from '../engine/metrics';
import { PHASE_LABEL, tempoToString } from '../engine/timeline';
import type { Evaluation, Status } from '../engine/types';
import { Avatar, jointStatuses, metricJoint } from '../scene/Avatar';
import { CameraRig } from '../scene/CameraRig';
import { fitCamera, keyLightFor, project } from '../scene/camera';
import { Lights } from '../scene/Environment';
import { GymRoom, RoomLighting } from '../scene/GymRoom';
import { BakedRoom } from '../scene/env/BakedRoom';
import { LiveMirror, createMirrorLink } from '../scene/env/LiveMirror';
import { useEnvironment } from '../scene/env/useEnvironment';
import { Repaint, tuneRenderer } from '../scene/Repaint';
import { STATION_ROOM } from '../scene/layout';
import { Gauges } from '../scene/Gauges';
import { XRay } from '../scene/XRay';
import { gaugeArcs, type GaugeArc } from '../scene/gauges';
import { AMBIENT_LIGHT, PALETTES, withAmbient, withFloorTint } from '../scene/palette';
import type { StationCompProps } from './props';
import { activationFor } from './timing';
import { useStationFrame } from './useStation';
import { deg } from '../ui/format';

export const SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace";

const STATUS_ICON: Record<Status, string> = { ok: '✔', aviso: '▲', riesgo: '✖' };
const SHORT_LABEL: Partial<Record<string, string>> = {
  'knee.flex': 'Rodilla',
  'elbow.flex': 'Codo',
  'hip.flex': 'Cadera',
  'shoulder.elev': 'Hombro',
  'trunk.incline': 'Tronco',
  'neck.flex': 'Cuello',
  'pelvis.tilt': 'Pelvis',
  'ankle.dorsi': 'Tobillo',
  'scap.elev': 'Escápula',
  'knee.valgus': 'Valgo',
  'shoulder.abd': 'Codos (aper.)',
  'shoulder.flare': 'Codos (aper.)',
  'shoulder.flex': 'Hombro (flex.)',
  'shoulder.behind': 'Codo vs tronco',
  'scap.prot': 'Escápula (prot.)',
  'wrist.ext': 'Muñeca',
  'lumbar.flex': 'Lumbar',
  'hip.abd': 'Cadera (aper.)',
  'foot.heelLift': 'Talón',
};

/** Marcadores numerados: separa los que caen demasiado cerca para que no se tapen. */
function spreadBadges<T extends { x: number; y: number; ax: number; ay: number }>(items: T[], minDist: number): T[] {
  const out = items.map((i) => ({ ...i }));
  for (let iter = 0; iter < 6; iter++) {
    for (let i = 0; i < out.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = out[j]!;
        const b = out[i]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          // Empuja el marcador en la dirección que lo aleja de su articulación.
          let ux = b.x - b.ax;
          let uy = b.y - b.ay;
          const ul = Math.hypot(ux, uy) || 1;
          ux /= ul;
          uy /= ul;
          b.x += ux * (minDist - d + 2);
          b.y += uy * (minDist - d + 2);
        }
      }
    }
  }
  return out;
}

/** Elevación de cámara admitida (0° = a ras de suelo, 89° = cenital). */
export const clampElevation = (e: number) => Math.min(89, Math.max(0, e));

function worstEval(evals: readonly Evaluation[]): Evaluation | undefined {
  let w: Evaluation | undefined;
  for (const e of evals) if (!w || STATUS_RANK[e.status] > STATUS_RANK[w.status]) w = e;
  return w && w.status !== 'ok' ? w : undefined;
}

export const StationComposition: React.FC<StationCompProps> = (props) => {
  // Fuera del lienzo 3D: aquí sí llega el contexto de Remotion (espera al modelo al renderizar).
  const anatomy = useAnatomy(props.anthro.sex);
  const env = useEnvironment();
  // Si la sala llega con la estación ya a la vista, se prepara antes de sustituir a la procedural.
  const [envAtMount] = useState(() => env !== null);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { mod, seg, variant, timeline, state, result } = useStationFrame(props, frame, fps);
  const palette = PALETTES[props.theme];
  // La sala: el ambiente elegido y el suelo con el color de la zona de la estación en el gimnasio.
  const roomPalette = withFloorTint(withAmbient(palette, props.ambient ?? 'dia'), palette.zone[mod.content.zone]);
  const views = mod.content.views;
  const view = views.find((v) => v.id === props.viewId) ?? views[0]!;
  // Encuadre estable para toda la serie: cuerpo en las posturas extremas + puntos de la máquina.
  const framePts = useMemo(() => {
    const pts: Vector3[] = [];
    for (const p of [0, 0.5, 1]) {
      const r = evaluateFrame(mod.logic, mod.content, { anthro: props.anthro, seg, variantId: props.variantId, errorId: props.errorId, loadKg: props.loadKg, p, phase: 'concentrica' });
      const bd = r.body;
      pts.push(bd.head.clone().add(new Vector3(0, seg.headRadius, 0)), bd.c7, bd.pelvis.origin);
      for (const side of ['L', 'R'] as const) {
        pts.push(bd.arms[side].elbow, bd.arms[side].grip, bd.legs[side].knee, bd.legs[side].toe, bd.legs[side].heel);
      }
      pts.push(...mod.logic.framePoints(r.machine));
    }
    return pts;
  }, [mod, seg, props.anthro, props.variantId, props.errorId, props.loadKg]);
  // La app pasa la cámara ya interpolada (`cam`); el vídeo usa la vista y los giros guardados.
  const azimuth = props.cam?.azimuth ?? view.azimuth + props.azimuthOffset;
  const elevation = props.cam?.elevation ?? clampElevation(view.elevation + (props.elevationOffset ?? 0));
  const cam = fitCamera({
    azimuth,
    elevation,
    points: framePts,
    // Misma escala desde cualquier lado: al orbitar, el cuerpo no cambia de tamaño.
    stable: true,
    width,
    height,
    // Dentro de la app no hay caja de pauta ni leyenda de ángulos: abajo solo queda la barra de vista.
    margins: {
      top: props.showOverlay ? (props.embedded ? 0.09 : 0.13) : 0.05,
      bottom: props.embedded ? 0.1 : props.showOverlay ? 0.2 : 0.05,
      side: 0.04,
      right: props.showGauges && !props.embedded ? ((props.uiScale ?? 1) > 1.2 ? 0.3 : 0.22) : 0.04,
    },
    zoomFactor: props.zoom,
  });
  const b = mod.logic.bounds;
  const floorCenter: [number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
  const machineRef = useRef<Group>(null);
  const avatarRef = useRef<Group>(null);
  const mirrorLink = useMemo(createMirrorLink, []);
  const toCamera = cam.position.clone().sub(cam.target).normalize();
  const bd = result.body;
  const xrayPts = [bd.head, bd.c7, bd.c7.clone().lerp(bd.pelvis.origin, 0.5), bd.pelvis.origin];
  for (const side of ['L', 'R'] as const) xrayPts.push(bd.arms[side].elbow, bd.arms[side].wrist, bd.legs[side].knee, bd.legs[side].ankle);
  const roomSize: [number, number] = [Math.max(5.2, b.max[0] - b.min[0] + 2.8), Math.max(5.2, b.max[2] - b.min[2] + 2.8)];
  const statuses = jointStatuses(result.evaluations);
  const arcs = props.showGauges ? gaugeArcs(result.body, result.metrics, mod.content.keyMetrics) : [];
  const arcStatus = (a: GaugeArc): Status | undefined => {
    const joint = metricJoint(a.metric);
    return statuses.get(a.side ? `${joint}.${a.side}` : joint) ?? statuses.get(joint);
  };
  const worst = worstEval(result.evaluations);
  const cues = variant.cues[state.kind] ?? [];
  const segFrames = state.endFrame - state.startFrame;
  // Si a cada pauta le tocaría menos de 1,2 s no da tiempo a leerla: se queda la primera.
  const readable = segFrames / Math.max(1, cues.length) >= 1.2 * fps;
  const cueIdx = cues.length && readable ? Math.min(cues.length - 1, Math.floor(state.u * cues.length)) : 0;
  // Fundido solo al cambiar de fase; dentro de la fase las pautas se relevan sin dejar la caja vacía.
  const cueOpacity = interpolate(frame, [state.startFrame, state.startFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const error = props.errorId ? mod.content.errors.find((e) => e.id === props.errorId) : undefined;
  // Error elegido pero sin alertas en este fotograma: se evalúa en otro momento de la repetición.
  const errorLater = error && !worst ? errorMoment(variant, error) : undefined;
  const repSegments = timeline.segments.filter((s) => s.rep === (state.rep || 1));
  const repStart = repSegments[0]?.start ?? 0;
  const repEnd = repSegments[repSegments.length - 1]?.end ?? 1;
  const unit = (Math.min(width, height) / 900) * (props.uiScale ?? 1);
  const compact = (props.uiScale ?? 1) > 1.2;
  const badges = spreadBadges(
    arcs.map((a, i) => {
      const [ax, ay] = project(cam, a.center);
      const [x, y] = project(cam, a.label);
      // Sin estado si su ventana no se evalúa en esta fase (gris, sin ✔).
      return { key: `${a.metric}${a.side ?? ''}`, n: i + 1, a, ax, ay, x, y, status: arcStatus(a) };
    }),
    30 * unit,
  );
  const badgeSize = 26 * unit;
  const neutral = props.theme === 'claro' ? '#646b75' : '#8b95a2';
  const statusColor = (st: Status | undefined) => (st ? palette.status[st] : neutral);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg, fontFamily: props.theme === 'terminal' ? MONO : SANS }}>
      <ThreeCanvas width={width} height={height} dpr={1} orthographic shadows frameloop="demand" gl={{ preserveDrawingBuffer: true, antialias: true }} onCreated={tuneRenderer}>
        <color attach="background" args={[palette.bg]} />
        <CameraRig spec={cam} />
        {/* Con la sala horneada, las sombras caen de las luminarias del techo (no giran con la cámara). */}
        <Lights keyPosition={keyLightFor(cam)} shadowPosition={env ? [floorCenter[0] + 2.2, 7.5, floorCenter[1] + 1.3] : undefined} />
        <RoomLighting />
        {(() => {
          const procedural = <GymRoom palette={palette} center={floorCenter} size={roomSize} azimuth={azimuth} elevation={elevation} variant="station" />;
          return env ? (
            <BakedRoom
              asset={env.rooms.station}
              palette={roomPalette}
              light={AMBIENT_LIGHT[props.ambient ?? 'dia']}
              mirrorLink={props.mirror ? mirrorLink : undefined}
              azimuth={azimuth}
              position={[floorCenter[0], 0, floorCenter[1]]}
              floorSize={[STATION_ROOM.size, STATION_ROOM.size]}
              warm={!envAtMount}
              fallback={procedural}
            />
          ) : (
            procedural
          );
        })()}
        <group ref={machineRef}>
          <mod.Machine m={result.machine} palette={palette} H={seg.H} />
        </group>
        <XRay target={machineRef} points={xrayPts} toCamera={toCamera} />
        <group ref={avatarRef}>
          <Avatar
            sex={props.anthro.sex}
            body={result.body}
            palette={palette}
            statuses={statuses}
            muscles={variant.muscles}
            activation={activationFor(state.kind)}
            showMuscles={props.showMuscles}
            pulse={frame * 0.35}
          />
        </group>
        {props.mirror && env && <LiveMirror link={mirrorLink} subjects={[machineRef, avatarRef]} />}
        {props.showGauges && <Gauges arcs={arcs} statusOf={arcStatus} colors={palette.status} neutral={neutral} />}
        <Repaint ready={[env, anatomy]} />
      </ThreeCanvas>

      {props.showGauges &&
        badges.map(({ key, n, x, y, status: st }) => (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              translate: '-50% -50%',
              width: badgeSize,
              height: badgeSize,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: palette.labelBg,
              border: `${2.5 * unit}px solid ${statusColor(st)}`,
              color: palette.label,
              fontSize: 14 * unit,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {n}
          </div>
        ))}

      {/* En la app, las filas numeradas del panel Técnica hacen de leyenda. */}
      {props.showGauges && badges.length > 0 && !props.embedded && (
        <div
          style={{
            position: 'absolute',
            right: 28 * unit,
            top: (props.showOverlay ? 92 : 24) * unit,
            display: 'flex',
            flexDirection: 'column',
            gap: 6 * unit,
            background: palette.labelBg,
            borderRadius: 14 * unit,
            padding: `${10 * unit}px ${12 * unit}px`,
            color: palette.label,
            minWidth: (compact ? 150 : 210) * unit,
          }}
        >
          {badges
            .slice()
            .sort((p, q) => p.n - q.n)
            .map(({ key, n, a, status: st }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 * unit, fontSize: (compact ? 15 : 17) * unit }}>
                <span
                  style={{
                    width: 20 * unit,
                    height: 20 * unit,
                    borderRadius: '50%',
                    flex: 'none',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12 * unit,
                    fontWeight: 800,
                    background: statusColor(st),
                    color: palette.bg,
                  }}
                >
                  {n}
                </span>
                <span style={{ flex: 1, opacity: 0.9 }}>{SHORT_LABEL[a.metric] ?? METRIC_INFO[a.metric].label}</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{deg(a.value)}</span>
                <span style={{ color: statusColor(st), width: 14 * unit, textAlign: 'center' }}>{st ? STATUS_ICON[st] : '·'}</span>
              </div>
            ))}
        </div>
      )}

      {props.showOverlay && (
        <>
          {/* Dentro de la app la página ya muestra el nombre, la variante y la carga. */}
          {!props.embedded && (
            <div
              style={{
                position: 'absolute',
                left: 28 * unit,
                top: 24 * unit,
                color: palette.label,
                background: palette.labelBg,
                padding: `${12 * unit}px ${16 * unit}px`,
                borderRadius: 14 * unit,
                maxWidth: '55%',
              }}
            >
              <div style={{ fontSize: (compact ? 24 : 30) * unit, fontWeight: 800, letterSpacing: -0.5 }}>{compact ? variant.short : mod.content.name}</div>
              {!compact && (
                <div style={{ fontSize: 19 * unit, opacity: 0.85, marginTop: 4 * unit }}>
                  {variant.name} · {loadShort(mod.logic.load, props.loadKg)} · tempo {tempoToString(props.tempo)}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              position: 'absolute',
              right: 28 * unit,
              top: 24 * unit,
              color: palette.label,
              background: palette.labelBg,
              border: `${2 * unit}px solid ${errorLater ? neutral : palette.status[worst?.status ?? 'ok']}`,
              padding: `${10 * unit}px ${16 * unit}px`,
              borderRadius: 14 * unit,
              fontSize: 19 * unit,
              fontWeight: 700,
              maxWidth: '38%',
            }}
          >
            <span style={{ color: errorLater ? neutral : palette.status[worst?.status ?? 'ok'] }}>{errorLater ? '◷' : STATUS_ICON[worst?.status ?? 'ok']}</span>{' '}
            {errorLater
              ? compact
                ? `Error: ${errorLater.replace(/^(en la|en el|durante el|en toda la) /, '')}`
                : `El error se ve ${errorLater}`
              : compact
              ? worst
                ? `${worst.status === 'riesgo' ? 'Riesgo' : 'Aviso'}: ${SHORT_LABEL[worst.window.metric] ?? worst.window.label}`
                : 'En rango'
              : worst
                ? `${worst.window.label}: ${worst.status === 'riesgo' ? 'fuera de rango' : 'al límite'}`
                : 'Técnica dentro de rango'}
          </div>

          {/* Error demostrado: a la izquierda, bajo el título (o en su lugar dentro de la app), lejos del HUD. */}
          {error && (
            <div
              style={{
                position: 'absolute',
                left: 28 * unit,
                top: (props.embedded ? 24 : compact ? 82 : 132) * unit,
                maxWidth: '55%',
                background: palette.status.riesgo,
                color: '#fff',
                padding: `${6 * unit}px ${16 * unit}px`,
                borderRadius: 12 * unit,
                fontSize: 18 * unit,
                fontWeight: 800,
                letterSpacing: 0.3,
              }}
            >
              {compact ? `✖ ${error.label}` : `DEMOSTRACIÓN DE ERROR · ${error.label}`}
            </div>
          )}

          {/* Fase, pauta y progreso de la repetición: en la app los dan la línea de tiempo y el guion del
              panel Técnica (y abajo va la barra de vista); en el vídeo y a pantalla completa, aquí. */}
          {!props.embedded && (
            <div style={{ position: 'absolute', left: 28 * unit, right: 28 * unit, bottom: 24 * unit, color: palette.label }}>
              <div
                style={{
                  background: palette.labelBg,
                  borderRadius: 14 * unit,
                  padding: `${12 * unit}px ${16 * unit}px`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 * unit, fontWeight: 700, marginBottom: 6 * unit }}>
                  <span>{PHASE_LABEL[state.kind]}</span>
                  <span style={{ opacity: 0.8 }}>{state.rep > 0 ? `Repetición ${state.rep}/${props.reps}` : 'Colocación'}</span>
                </div>
                <div style={{ fontSize: 22 * unit, minHeight: 30 * unit, opacity: cueOpacity }}>{cues[cueIdx] ?? ''}</div>
                <div style={{ display: 'flex', gap: 4 * unit, marginTop: 10 * unit, height: 8 * unit }}>
                  {repSegments.map((s) => {
                    const active = s === state.segment;
                    const w = ((s.end - s.start) / Math.max(0.001, repEnd - repStart)) * 100;
                    return (
                      <div
                        key={`${s.kind}${s.start}`}
                        style={{
                          width: `${w}%`,
                          borderRadius: 4 * unit,
                          background: active ? palette.accent : palette.floorLine,
                          overflow: 'hidden',
                        }}
                      >
                        {active && <div style={{ width: `${state.u * 100}%`, height: '100%', background: palette.label, opacity: 0.6 }} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AbsoluteFill>
  );
};
