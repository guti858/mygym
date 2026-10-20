import { Player, type PlayerRef } from '@remotion/player';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { computeSegments } from '../engine/anthropometry';
import { evaluateFrame, findVariant, startAtOf } from '../engine/evaluate';
import { loadShort } from '../engine/load';
import { COMP_H, COMP_W, FPS, type StationCompProps } from '../remotion/props';
import { StationComposition } from '../remotion/StationComposition';
import { durationInFrames, stationTimeline } from '../remotion/timing';
import { useStationFrame } from '../remotion/useStation';
import { getModule, type StationModule } from '../stations/modules';
import { bridge } from '../state/bridge';
import { settingsFor, useApp, useFrame, type StationSettings } from '../state/store';
import { JointsPanel } from '../ui/panels/JointsPanel';
import { MachinePanel } from '../ui/panels/MachinePanel';
import { MusclesPanel } from '../ui/panels/MusclesPanel';
import { ScriptPanel } from '../ui/panels/ScriptPanel';
import { SettingsPanel } from '../ui/panels/SettingsPanel';
import { Timeline } from '../ui/Timeline';
import { useMedia } from '../ui/useMedia';

type Tab = 'ajustes' | 'guion' | 'articulaciones' | 'musculos' | 'maquina';
const TAB_LABEL: Record<Tab, string> = {
  ajustes: 'Ajustes',
  guion: 'Guion',
  articulaciones: 'Articulaciones',
  musculos: 'Músculos',
  maquina: 'Máquina',
};

/** Escenario con el Player de Remotion (memoizado: no se re-renderiza en cada fotograma). */
const Stage = memo(function Stage({
  props,
  duration,
  playerRef,
  onRotate,
}: {
  props: StationCompProps;
  duration: number;
  playerRef: React.RefObject<PlayerRef | null>;
  onRotate: (deg: number) => void;
}) {
  const rate = useFrame((s) => s.rate);
  return (
    <div
      className="stage"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const startX = e.clientX;
        let last = 0;
        const move = (ev: PointerEvent) => {
          const deg = Math.round((ev.clientX - startX) / 4);
          if (deg !== last) {
            onRotate(deg - last);
            last = deg;
          }
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
    >
      <Player
        ref={playerRef}
        component={StationComposition}
        inputProps={props}
        durationInFrames={duration}
        compositionWidth={COMP_W}
        compositionHeight={COMP_H}
        fps={FPS}
        loop
        autoPlay
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen
        playbackRate={rate}
        acknowledgeRemotionLicense
        style={{ width: '100%', aspectRatio: `${COMP_W} / ${COMP_H}` }}
      />
    </div>
  );
});

function LivePanels({ mod, st, props, playerRef }: { mod: StationModule; st: StationSettings; props: StationCompProps; playerRef: React.RefObject<PlayerRef | null> }) {
  const frame = useFrame((s) => s.frame);
  const playing = useFrame((s) => s.playing);
  const rate = useFrame((s) => s.rate);
  const wide = useMedia('(min-width: 1100px)');
  const [tab, setTab] = useState<Tab>(wide ? 'guion' : 'ajustes');
  const { variant, timeline, state, result } = useStationFrame(props, frame, FPS);
  bridge.current = { result: result as never, state, timeline };
  bridge.fps = FPS;

  // Máximo de momento a lo largo del movimiento, para escalar las barras.
  const anthro = props.anthro;
  const momentMax = useMemo(() => {
    const seg = computeSegments(anthro);
    let max = 1;
    for (let i = 0; i <= 10; i++) {
      const r = evaluateFrame(mod.logic, mod.content, { anthro, seg, variantId: st.variantId, errorId: st.errorId, loadKg: st.loadKg, p: i / 10, phase: 'concentrica' });
      for (const v of Object.values(r.moments)) max = Math.max(max, v);
    }
    return max;
  }, [mod, anthro, st.variantId, st.errorId, st.loadKg]);

  const error = st.errorId ? mod.content.errors.find((e) => e.id === st.errorId) : undefined;
  const panels: Record<Tab, React.ReactNode> = {
    ajustes: <SettingsPanel mod={mod} st={st} />,
    guion: <ScriptPanel mod={mod} variant={variant} state={state} error={error} />,
    articulaciones: <JointsPanel windows={variant.windows} evaluations={result.evaluations} p={state.p} phase={state.kind} moments={result.moments} momentMax={momentMax} />,
    musculos: <MusclesPanel variant={variant} />,
    maquina: <MachinePanel setup={result.setup} sources={mod.content.sources} />,
  };
  const tabs: Tab[] = wide ? ['guion', 'articulaciones', 'musculos', 'maquina'] : ['ajustes', 'guion', 'articulaciones', 'musculos', 'maquina'];
  const current = tabs.includes(tab) ? tab : tabs[0]!;

  const timelineEl = (
    <Timeline
      timeline={timeline}
      state={state}
      frame={frame}
      fps={FPS}
      player={playerRef.current}
      playing={playing}
      rate={rate}
      onRate={(r) => useFrame.setState({ rate: r })}
      reps={st.reps}
    />
  );

  return (
    <>
      <div className="station__timeline">{timelineEl}</div>
      {wide && (
        <aside className="station__left" aria-label="Ajustes de la estación">
          {panels.ajustes}
        </aside>
      )}
      <aside className="station__right">
        <div className="tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t} role="tab" aria-selected={current === t} className={current === t ? 'is-on' : ''} onClick={() => setTab(t)}>
              {TAB_LABEL[t]}
              {t === 'articulaciones' && result.status !== 'ok' && <span className={`badge s-${result.status}`}>!</span>}
            </button>
          ))}
        </div>
        <div className="tabpanel" role="tabpanel">
          {panels[current]}
        </div>
      </aside>
    </>
  );
}

export function StationView({ id }: { id: string }) {
  const mod = getModule(id)!;
  const app = useApp();
  const narrow = !useMedia('(min-width: 700px)');
  const st = settingsFor(app, id);
  const playerRef = useRef<PlayerRef | null>(null);
  const variant = findVariant(mod.content, st.variantId);

  const props = useMemo<StationCompProps>(
    () => ({
      stationId: id,
      variantId: variant.id,
      errorId: st.errorId,
      loadKg: st.loadKg,
      anthro: app.anthro,
      tempo: st.tempo,
      reps: st.reps,
      viewId: st.viewId,
      azimuthOffset: st.azimuthOffset,
      zoom: st.zoom,
      showMuscles: app.showMuscles,
      showGauges: app.showGauges,
      showOverlay: app.showOverlay,
      theme: app.theme,
      uiScale: narrow ? 1.5 : 1,
    }),
    [id, variant.id, st, app.anthro, app.showMuscles, app.showGauges, app.showOverlay, app.theme, narrow],
  );
  const startAt = startAtOf(mod.logic, variant.id);
  const duration = useMemo(() => durationInFrames(stationTimeline(st.tempo, st.reps, startAt), FPS), [st.tempo, st.reps, startAt]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    bridge.player = p;
    const onFrame = (e: { detail: { frame: number } }) => useFrame.getState().setFrame(e.detail.frame);
    const onPlay = () => useFrame.setState({ playing: true });
    const onPause = () => useFrame.setState({ playing: false });
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    useFrame.setState({ playing: p.isPlaying(), frame: p.getCurrentFrame() });
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      if (bridge.player === p) bridge.player = null;
      bridge.current = null;
    };
  }, [id]);

  const onRotate = useMemo(
    () => (deg: number) => {
      const cur = settingsFor(useApp.getState(), id);
      useApp.getState().update(id, { azimuthOffset: cur.azimuthOffset + deg });
    },
    [id],
  );

  return (
    <div className="station">
      <section className="station__center">
        <header className="station__title">
          <div>
            <p className="eyebrow">{mod.content.summary}</p>
            <h1>{mod.content.name}</h1>
          </div>
          <div className="station__chips">
            <span className="tag">{variant.short}</span>
            <span className="tag mono">{loadShort(mod.logic.load, st.loadKg)}</span>
            {st.errorId && <span className="tag tag--risk">Error: {mod.content.errors.find((e) => e.id === st.errorId)?.label}</span>}
          </div>
        </header>
        <Stage props={props} duration={duration} playerRef={playerRef} onRotate={onRotate} />
      </section>
      <LivePanels mod={mod} st={st} props={props} playerRef={playerRef} />
    </div>
  );
}
