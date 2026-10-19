import { ThreeCanvas } from '@remotion/three';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { STATUS_RANK, evaluateFrame } from '../engine/evaluate';
import { METRIC_INFO } from '../engine/metrics';
import { PHASE_LABEL, tempoToString } from '../engine/timeline';
import type { Evaluation, Status } from '../engine/types';
import { Avatar, jointStatuses, metricJoint } from '../scene/Avatar';
import { CameraRig } from '../scene/CameraRig';
import { fitCamera, keyLightFor, project } from '../scene/camera';
import { Floor, Lights } from '../scene/Environment';
import { Gauges } from '../scene/Gauges';
import { gaugeArcs, type GaugeArc } from '../scene/gauges';
import { PALETTES } from '../scene/palette';
import type { StationCompProps } from './props';
import { activationFor } from './timing';
import { useStationFrame } from './useStation';

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
};

/** Evita solapes entre etiquetas: las separa en vertical manteniendo su orden. */
function placeLabels<T extends { x: number; y: number; ax: number }>(items: T[], unit: number): T[] {
  const gap = 34 * unit;
  const wide = 170 * unit;
  const out = items.map((i) => ({ ...i })).sort((a, b) => a.y - b.y);
  for (let i = 0; i < out.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = out[j]!;
      const b = out[i]!;
      if (Math.abs(a.x - b.x) < wide && b.y - a.y < gap) b.y = a.y + gap;
    }
  }
  // Separa la etiqueta del punto anclado hacia el lado más libre.
  for (const l of out) {
    if (Math.abs(l.x - l.ax) < 40 * unit) l.x = l.ax + (l.x >= l.ax ? 1 : -1) * 70 * unit;
  }
  return out;
}

function worstEval(evals: readonly Evaluation[]): Evaluation | undefined {
  let w: Evaluation | undefined;
  for (const e of evals) if (!w || STATUS_RANK[e.status] > STATUS_RANK[w.status]) w = e;
  return w && w.status !== 'ok' ? w : undefined;
}

export const StationComposition: React.FC<StationCompProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { mod, seg, variant, timeline, state, result } = useStationFrame(props, frame, fps);
  const palette = PALETTES[props.theme];
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
  const cam = fitCamera({
    azimuth: view.azimuth + props.azimuthOffset,
    elevation: view.elevation,
    points: framePts,
    width,
    height,
    margins: props.showOverlay ? { top: 0.13, bottom: 0.2, side: 0.05 } : { top: 0.05, bottom: 0.05, side: 0.05 },
    zoomFactor: props.zoom,
  });
  const b = mod.logic.bounds;
  const floorCenter: [number, number] = [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2];
  const statuses = jointStatuses(result.evaluations);
  const arcs = props.showGauges ? gaugeArcs(result.body, result.metrics, mod.content.keyMetrics) : [];
  const arcStatus = (a: GaugeArc): Status | undefined => {
    const joint = metricJoint(a.metric);
    return statuses.get(a.side ? `${joint}.${a.side}` : joint) ?? statuses.get(joint);
  };
  const worst = worstEval(result.evaluations);
  const cues = variant.cues[state.kind] ?? [];
  const segFrames = state.endFrame - state.startFrame;
  const cueIdx = cues.length ? Math.min(cues.length - 1, Math.floor(state.u * cues.length)) : 0;
  const cueStart = state.startFrame + Math.floor((cueIdx * segFrames) / Math.max(1, cues.length));
  const cueOpacity = interpolate(frame, [cueStart, cueStart + 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const error = props.errorId ? mod.content.errors.find((e) => e.id === props.errorId) : undefined;
  const repSegments = timeline.segments.filter((s) => s.rep === (state.rep || 1));
  const repStart = repSegments[0]?.start ?? 0;
  const repEnd = repSegments[repSegments.length - 1]?.end ?? 1;
  const unit = (Math.min(width, height) / 900) * (props.uiScale ?? 1);
  const compact = (props.uiScale ?? 1) > 1.2;
  const labels = placeLabels(
    arcs.map((a) => {
      const [ax, ay] = project(cam, a.center);
      const [x, y] = project(cam, a.label);
      return { key: `${a.metric}${a.side ?? ''}`, a, ax, ay, x, y, status: arcStatus(a) ?? ('ok' as Status) };
    }),
    unit,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg, fontFamily: props.theme === 'terminal' ? MONO : SANS }}>
      <ThreeCanvas width={width} height={height} orthographic shadows frameloop="demand" gl={{ preserveDrawingBuffer: true, antialias: true }}>
        <color attach="background" args={[palette.bg]} />
        <CameraRig spec={cam} />
        <Lights keyPosition={keyLightFor(cam)} />
        <Floor palette={palette} size={7} center={floorCenter} />
        <mod.Machine m={result.machine} palette={palette} H={seg.H} />
        <Avatar
          body={result.body}
          palette={palette}
          statuses={statuses}
          muscles={variant.muscles}
          activation={activationFor(state.kind)}
          showMuscles={props.showMuscles}
          pulse={frame * 0.35}
        />
        {props.showGauges && <Gauges arcs={arcs} statusOf={arcStatus} colors={palette.status} />}
      </ThreeCanvas>

      {props.showGauges && (
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {labels.map((l) => (
            <line key={l.key} x1={l.ax} y1={l.ay} x2={l.x} y2={l.y} stroke={palette.status[l.status]} strokeWidth={1.5 * unit} strokeOpacity={0.8} />
          ))}
        </svg>
      )}
      {props.showGauges &&
        labels.map(({ key, a, x, y, status: st }) => {
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                translate: '-50% -50%',
                padding: `${3 * unit}px ${8 * unit}px`,
                borderRadius: 999,
                background: palette.labelBg,
                border: `${2 * unit}px solid ${palette.status[st]}`,
                color: palette.label,
                fontSize: 17 * unit,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {SHORT_LABEL[a.metric] ?? METRIC_INFO[a.metric].label} {Math.round(a.value)}°
            </div>
          );
        })}

      {props.showOverlay && (
        <>
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
                {variant.name} · {props.loadKg} kg · tempo {tempoToString(props.tempo)}
              </div>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              right: 28 * unit,
              top: 24 * unit,
              color: palette.label,
              background: palette.labelBg,
              border: `${2 * unit}px solid ${palette.status[worst?.status ?? 'ok']}`,
              padding: `${10 * unit}px ${16 * unit}px`,
              borderRadius: 14 * unit,
              fontSize: 19 * unit,
              fontWeight: 700,
              maxWidth: '38%',
            }}
          >
            <span style={{ color: palette.status[worst?.status ?? 'ok'] }}>{STATUS_ICON[worst?.status ?? 'ok']}</span>{' '}
            {compact
              ? worst
                ? worst.status === 'riesgo'
                  ? 'Riesgo'
                  : 'Aviso'
                : 'En rango'
              : worst
                ? `${worst.status === 'riesgo' ? 'Riesgo' : 'Aviso'}: ${worst.window.label}`
                : 'Técnica dentro de rango'}
          </div>

          {error && (
            <div
              style={{
                position: 'absolute',
                left: compact ? 28 * unit : '50%',
                top: compact ? 82 * unit : 132 * unit,
                translate: compact ? '0 0' : '-50% 0',
                maxWidth: compact ? '80%' : undefined,
                background: palette.status.riesgo,
                color: '#fff',
                padding: `${6 * unit}px ${16 * unit}px`,
                borderRadius: 999,
                fontSize: 18 * unit,
                fontWeight: 800,
                letterSpacing: 0.3,
              }}
            >
              {compact ? `✖ ${error.label}` : `DEMOSTRACIÓN DE ERROR · ${error.label}`}
            </div>
          )}

          <div style={{ position: 'absolute', left: 28 * unit, right: 28 * unit, bottom: 24 * unit, color: palette.label }}>
            <div
              style={{
                background: palette.labelBg,
                borderRadius: 14 * unit,
                padding: `${12 * unit}px ${16 * unit}px`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20 * unit, fontWeight: 700 }}>
                <span>{PHASE_LABEL[state.kind]}</span>
                <span style={{ opacity: 0.8 }}>{state.rep > 0 ? `Repetición ${state.rep}/${props.reps}` : 'Colocación'}</span>
              </div>
              <div style={{ fontSize: 22 * unit, marginTop: 6 * unit, minHeight: 30 * unit, opacity: cueOpacity }}>{cues[cueIdx] ?? ''}</div>
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
        </>
      )}
    </AbsoluteFill>
  );
};
