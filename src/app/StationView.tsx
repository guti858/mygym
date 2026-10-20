import { Player, type PlayerRef } from '@remotion/player';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { computeSegments } from '../engine/anthropometry';
import { evaluateFrame, findVariant, startAtOf } from '../engine/evaluate';
import { COMP_H, COMP_W, FPS, type StationCompProps } from '../remotion/props';
import { StationComposition, clampElevation } from '../remotion/StationComposition';
import { durationInFrames, frameState, stationTimeline } from '../remotion/timing';
import { useStationFrame } from '../remotion/useStation';
import { gaugeArcs } from '../scene/gauges';
import { getModule, type StationModule } from '../stations/modules';
import { bridge } from '../state/bridge';
import { settingsFor, useApp, useFrame, type StationSettings } from '../state/store';
import { MachinePanel } from '../ui/panels/MachinePanel';
import { MusclesPanel } from '../ui/panels/MusclesPanel';
import { SettingsPanel } from '../ui/panels/SettingsPanel';
import { TechniquePanel } from '../ui/panels/TechniquePanel';
import { Timeline } from '../ui/Timeline';
import { useMedia } from '../ui/useMedia';
import { angleDelta, useSmoothCamera, type CameraAngles } from '../ui/useSmoothCamera';
import { ViewBar, type ViewBarSize } from '../ui/ViewBar';

/** Escritorio: ajustes a la izquierda y el resto en pestañas a la derecha. Móvil: todo en pestañas. */
const WIDE = '(min-width: 1100px)';

type Tab = 'ajustes' | 'tecnica' | 'musculos' | 'maquina';
const TAB_LABEL: Record<Tab, string> = {
  ajustes: 'Ajustes',
  tecnica: 'Técnica',
  musculos: 'Músculos',
  maquina: 'Máquina',
};

/** Escenario con el Player de Remotion (memoizado: no se re-renderiza en cada fotograma). */
const Stage = memo(function Stage({
  props,
  target,
  jumpKey,
  duration,
  playerRef,
  onOrbit,
  onRelease,
}: {
  props: StationCompProps;
  target: CameraAngles;
  /** Al cambiar (y no ser 0), la cámara salta al objetivo en lugar de orbitar hasta él. */
  jumpKey: number;
  duration: number;
  playerRef: React.RefObject<PlayerRef | null>;
  /** Giro (azimut) e inclinación (elevación) relativos, en grados. */
  onOrbit: (dAzimuth: number, dElevation: number) => void;
  /** Fin del arrastre: la cámara se ajusta a una vista si ha quedado muy cerca. */
  onRelease: () => void;
}) {
  const rate = useFrame((s) => s.rate);
  // Con «reducir movimiento» la serie no arranca sola y la cámara no se anima entre vistas.
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');
  const cam = useSmoothCamera(target, reduceMotion, jumpKey);
  // Rótulos a escala del tamaño real del reproductor: legibles aunque el vídeo se muestre pequeño.
  const stageRef = useRef<HTMLDivElement>(null);
  const [uiScale, setUiScale] = useState(props.uiScale);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      if (w > 0) setUiScale(Math.round(Math.min(2.2, Math.max(1, 900 / w)) * 20) / 20);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // A pantalla completa (proyectar en clase), la escena vuelve al aspecto del vídeo: título, pauta y
  // leyenda de ángulos dentro de la imagen.
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const on = (e: { detail: { isFullscreen: boolean } }) => setFullscreen(e.detail.isFullscreen);
    p.addEventListener('fullscreenchange', on);
    return () => p.removeEventListener('fullscreenchange', on);
  }, [playerRef]);
  const inputProps = useMemo(() => ({ ...props, uiScale: fullscreen ? 1 : uiScale, cam, embedded: !fullscreen }), [props, uiScale, cam, fullscreen]);
  return (
    <div
      ref={stageRef}
      className="stage"
      tabIndex={0}
      aria-label="Escena 3D: arrastra o usa las flechas para girar e inclinar la cámara; Inicio vuelve a la vista"
      onKeyDown={(e) => {
        const step: Record<string, [number, number]> = { ArrowLeft: [-15, 0], ArrowRight: [15, 0], ArrowUp: [0, 10], ArrowDown: [0, -10] };
        const d = step[e.key];
        if (d) {
          e.preventDefault();
          onOrbit(d[0], d[1]);
        } else if (e.key === 'Home') {
          e.preventDefault();
          onOrbit(Number.NaN, Number.NaN);
        }
      }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const startX = e.clientX;
        const startY = e.clientY;
        // En pantallas táctiles el gesto vertical desplaza la página: solo se gira.
        const tilt = e.pointerType === 'mouse' || e.pointerType === 'pen';
        let lastX = 0;
        let lastY = 0;
        const move = (ev: PointerEvent) => {
          const dx = Math.round((ev.clientX - startX) / 4);
          const dy = tilt ? Math.round((ev.clientY - startY) / 4) : 0;
          if (dx !== lastX || dy !== lastY) {
            onOrbit(dx - lastX, dy - lastY);
            lastX = dx;
            lastY = dy;
          }
        };
        const up = () => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          if (lastX || lastY) onRelease();
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        // En móvil, si el gesto acaba siendo un desplazamiento de la página, llega pointercancel.
        window.addEventListener('pointercancel', up);
      }}
    >
      <Player
        ref={playerRef}
        component={StationComposition}
        inputProps={inputProps}
        durationInFrames={duration}
        compositionWidth={COMP_W}
        compositionHeight={COMP_H}
        fps={FPS}
        loop
        autoPlay={!reduceMotion}
        controls={false}
        clickToPlay={false}
        doubleClickToFullscreen
        playbackRate={rate}
        acknowledgeRemotionLicense
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
});

function LivePanels({ mod, st, props, playerRef }: { mod: StationModule; st: StationSettings; props: StationCompProps; playerRef: React.RefObject<PlayerRef | null> }) {
  const frame = useFrame((s) => s.frame);
  const showGauges = useApp((s) => s.showGauges);
  const wide = useMedia(WIDE);
  const [tab, setTab] = useState<Tab>('tecnica');
  const tabsId = useId();
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
  // Número de la insignia de cada métrica en la escena: las filas de Técnica hacen de leyenda.
  const numbers = showGauges ? new Map(gaugeArcs(result.body, result.metrics, mod.content.keyMetrics).map((a, i) => [a.metric as string, i + 1])) : null;

  const panels: Record<Tab, React.ReactNode> = {
    ajustes: <SettingsPanel mod={mod} st={st} />,
    tecnica: (
      <TechniquePanel
        mod={mod}
        st={st}
        variant={variant}
        timeline={timeline}
        state={state}
        fps={FPS}
        evaluations={result.evaluations}
        moments={result.moments}
        momentMax={momentMax}
        numbers={numbers}
        player={playerRef.current}
      />
    ),
    musculos: <MusclesPanel variant={variant} />,
    maquina: <MachinePanel setup={result.setup} generalCues={mod.content.generalCues} />,
  };
  const tabs: Tab[] = wide ? ['tecnica', 'musculos', 'maquina'] : ['ajustes', 'tecnica', 'musculos', 'maquina'];
  const current = tabs.includes(tab) ? tab : 'tecnica';
  const tabId = (t: Tab) => `${tabsId}-tab-${t}`;
  const panelId = `${tabsId}-panel`;

  return (
    <>
      {wide && (
        <aside className="station__left" aria-label="Ajustes de la estación" data-fit="ajustes">
          {panels.ajustes}
        </aside>
      )}
      <aside className="station__right" aria-label="Técnica, músculos y máquina">
        <div
          className="tabs"
          role="tablist"
          aria-label="Paneles de la estación"
          onKeyDown={(e) => {
            // Patrón de pestañas: las flechas recorren las pestañas y las activan.
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const next = tabs[(tabs.indexOf(current) + d + tabs.length) % tabs.length]!;
            setTab(next);
            document.getElementById(tabId(next))?.focus();
          }}
        >
          {tabs.map((t) => (
            <button
              key={t}
              id={tabId(t)}
              role="tab"
              aria-selected={current === t}
              aria-controls={panelId}
              tabIndex={current === t ? 0 : -1}
              className={current === t ? 'is-on' : ''}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        {/* Una instancia por pestaña: se repite el fundido de entrada. */}
        <div className="tabpanel" role="tabpanel" id={panelId} aria-labelledby={tabId(current)} key={current} data-fit={current}>
          {panels[current]}
        </div>
      </aside>
    </>
  );
}

/** Línea de tiempo bajo la escena: solo necesita la fase del fotograma (sin evaluar la postura). */
function LiveTimeline({ st, startAt, playerRef }: { st: StationSettings; startAt: 'estiramiento' | 'contraccion'; playerRef: React.RefObject<PlayerRef | null> }) {
  const frame = useFrame((s) => s.frame);
  const playing = useFrame((s) => s.playing);
  const rate = useFrame((s) => s.rate);
  const timeline = useMemo(() => stationTimeline(st.tempo, st.reps, startAt), [st.tempo, st.reps, startAt]);
  return (
    <div className="station__timeline">
      <Timeline
        timeline={timeline}
        state={frameState(frame, FPS, timeline)}
        frame={frame}
        fps={FPS}
        player={playerRef.current}
        playing={playing}
        rate={rate}
        onRate={(r) => useFrame.setState({ rate: r })}
        reps={st.reps}
      />
    </div>
  );
}

/** Tiempo con la cámara en el ángulo del plano antes de orbitar hasta la vista (tapa la transición). */
const ENTRY_HOLD_MS = 450;

/**
 * Estación. Se queda montada (oculta y en pausa) al volver al gimnasio y se reutiliza al abrir otra:
 * el contexto WebGL no se destruye ni se recrea.
 */
export function StationView({ id, active }: { id: string; active: boolean }) {
  const mod = getModule(id)!;
  const app = useApp();
  const st = settingsFor(app, id);
  const playerRef = useRef<PlayerRef | null>(null);
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');
  // Entrada desde el plano del gimnasio: la cámara arranca mirando la máquina desde el mismo lado y,
  // cuando la estación ya se ve, orbita hasta su vista.
  const entryCamera = useApp((s) => s.entryCamera);
  const [entering, setEntering] = useState(() => (entryCamera?.stationId === id ? entryCamera : null));
  if (entryCamera && entryCamera.stationId === id && entryCamera.key !== entering?.key) setEntering(entryCamera);
  useEffect(() => {
    if (!entering) return;
    useApp.setState({ entryCamera: null });
    const t = setTimeout(() => setEntering(null), ENTRY_HOLD_MS);
    return () => clearTimeout(t);
  }, [entering]);
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
      elevationOffset: st.elevationOffset,
      zoom: st.zoom,
      showMuscles: app.showMuscles,
      showGauges: app.showGauges,
      showOverlay: app.showOverlay,
      theme: app.theme,
      uiScale: 1,
      embedded: true,
    }),
    [id, variant.id, st, app.anthro, app.showMuscles, app.showGauges, app.showOverlay, app.theme],
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
    // Otra estación en el mismo reproductor: la serie empieza desde el principio.
    p.seekTo(0);
    useFrame.setState({ playing: p.isPlaying(), frame: 0 });
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
      if (bridge.player === p) bridge.player = null;
      bridge.current = null;
    };
  }, [id]);

  const view = mod.content.views.find((v) => v.id === st.viewId) ?? mod.content.views[0]!;
  const targetAz = view.azimuth + st.azimuthOffset;
  const targetEl = clampElevation(view.elevation + st.elevationOffset);
  const enterAz = entering?.azimuth;
  const enterEl = entering?.elevation;
  const target = useMemo(
    () => (enterAz !== undefined && enterEl !== undefined ? { azimuth: enterAz, elevation: enterEl } : { azimuth: targetAz, elevation: targetEl }),
    [targetAz, targetEl, enterAz, enterEl],
  );
  // Oculta (en el gimnasio): en pausa y fuera del puente de la consola.
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (!active) {
      p.pause();
      if (bridge.player === p) bridge.player = null;
    } else {
      bridge.player = p;
      if (!reduceMotion) p.play();
    }
  }, [active, reduceMotion]);

  // Ancho de la escena: decide qué cabe en la barra de vista.
  const frameRef = useRef<HTMLDivElement>(null);
  const [barSize, setBarSize] = useState<ViewBarSize>('wide');
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      if (w > 0) setBarSize(w >= 640 ? 'wide' : w >= 460 ? 'narrow' : 'tiny');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const orbit = useMemo(() => {
    const current = () => {
      const s = settingsFor(useApp.getState(), id);
      return { s, view: mod.content.views.find((v) => v.id === s.viewId) ?? mod.content.views[0]! };
    };
    return {
      onOrbit(dAz: number, dEl: number) {
        const { s, view: v } = current();
        // NaN: volver a la vista sin giros.
        if (Number.isNaN(dAz)) return useApp.getState().update(id, { azimuthOffset: 0, elevationOffset: 0 });
        const el = clampElevation(v.elevation + s.elevationOffset + dEl);
        useApp.getState().update(id, { azimuthOffset: s.azimuthOffset + dAz, elevationOffset: el - v.elevation });
      },
      onRelease() {
        const { s, view: v } = current();
        const az = v.azimuth + s.azimuthOffset;
        const el = clampElevation(v.elevation + s.elevationOffset);
        // Si el arrastre acaba a menos de 6° de una vista, se ajusta a ella (y su botón se marca).
        const snap = mod.content.views.find((w) => Math.abs(angleDelta(w.azimuth, az)) <= 6 && Math.abs(w.elevation - el) <= 6);
        if (snap) useApp.getState().update(id, { viewId: snap.id, azimuthOffset: 0, elevationOffset: 0 });
        else useApp.getState().update(id, { azimuthOffset: angleDelta(v.azimuth, az) });
      },
    };
  }, [id, mod]);

  return (
    <div className="station" hidden={!active}>
      <section className="station__center">
        <header className="station__title">
          <h1>{mod.content.name}</h1>
          <p className="station__summary" title={mod.content.summary}>
            {mod.content.summary}
          </p>
          <button className="icon-btn info-btn" onClick={() => app.set({ infoOpen: true })} aria-label="Fuentes y avisos" title="Fuentes y avisos">
            ⓘ
          </button>
        </header>
        {/* Título, escena 4:3 y línea de tiempo comparten ancho: el que deja el alto disponible. */}
        <div className="scene__frame" ref={frameRef}>
          <Stage props={props} target={target} jumpKey={entering?.key ?? 0} duration={duration} playerRef={playerRef} onOrbit={orbit.onOrbit} onRelease={orbit.onRelease} />
          <ViewBar mod={mod} st={st} size={barSize} onFullscreen={() => playerRef.current?.requestFullscreen()} />
        </div>
        <LiveTimeline st={st} startAt={startAt} playerRef={playerRef} />
      </section>
      <LivePanels mod={mod} st={st} props={props} playerRef={playerRef} />
    </div>
  );
}
