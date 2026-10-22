import { Player, type PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEG } from '../engine/math';
import { MUSCLES, type MuscleId } from '../content/muscles';
import { FPS, type HubCompProps } from '../remotion/props';
import { HubComposition } from '../remotion/HubComposition';
import { project } from '../scene/camera';
import { HUB_PLAN_ELEVATION, clampPan, focusView, hubCamera, hubMargins, neighbor, panBy, zoomAt, type HubView as HubCam } from '../scene/hubCamera';
import { CATALOG, ZONE_LABEL, roleInStation, type Zone } from '../stations/catalog';
import { hubCorners, hubLabelY, hubPoint } from '../stations/hubPlacement';
import { getModule } from '../stations/modules';
import { settingsFor, useApp } from '../state/store';
import { BodyMap, type BodyMapEntry } from '../ui/BodyMap';
import { HUB_ZOOM_STEP, HubViewBar } from '../ui/HubViewBar';
import { useMedia } from '../ui/useMedia';
import { angleDelta, useSmoothHubView } from '../ui/useSmoothCamera';
import type { ViewBarSize } from '../ui/ViewBar';
import { crossfadeFrom } from '../ui/zoomTransition';

/** Píxeles de arrastre por cada giro de 90°. */
const DRAG_PX = 220;
/** Acercamiento a la máquina antes de fundirse con la estación (la cámara se asienta en ~0,5 s). */
const FLIGHT_MS = 600;
/** Al volver, la máquina visitada queda destacada este tiempo. */
const RECENT_MS = 1500;

const ZONE_ORDER: Zone[] = ['traccion', 'brazos', 'empuje', 'pierna', 'libre'];
/** Músculos que trabaja alguna estación, por orden alfabético (selector del filtro). */
const FILTER_MUSCLES = [...new Set(CATALOG.flatMap((c) => [...c.principal, ...c.secundarios]))].sort((a, b) => MUSCLES[a].name.localeCompare(MUSCLES[b].name, 'es'));

/**
 * Gimnasio. Se queda montado (oculto y en pausa) mientras se ve una estación: al volver no se
 * recrea el contexto WebGL ni se recompilan los shaders.
 *
 * En el plano: un clic elige una máquina (tarjeta con lo esencial) y otro clic, «Abrir estación»
 * o Intro la abre: la cámara se acerca a ella y se funde con la estación. Se puede girar, inclinar,
 * acercar y desplazar (barra de vista, arrastre, Ctrl/⌘ + rueda, pellizco y teclado).
 */
export function HubView({ active }: { active: boolean }) {
  const app = useApp();
  const playerRef = useRef<PlayerRef>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const opening = useRef(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const narrow = !useMedia('(min-width: 700px)');
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');
  const [compW, compH] = narrow ? [1000, 1000] : [1600, 900];
  const size = useMemo(() => ({ width: compW, height: compH }), [compW, compH]);
  const margins = useMemo(() => hubMargins(true), []);
  const filter = app.muscleFilter;
  const selected = app.hubSelected;

  // Giro con arrastre libre que al soltar se ajusta al cuarto de vuelta más cercano.
  const [drag, setDrag] = useState(0);
  const dragged = useRef(false);
  // Acercamiento a la máquina que se abre (la cámara deja de seguir la vista del usuario).
  const [flight, setFlight] = useState<{ id: string; view: HubCam } | null>(null);
  const [recent, setRecent] = useState<string | null>(null);
  const userView = useMemo<HubCam>(
    () => ({
      // En planta, los ejes de la sala quedan alineados con la pantalla.
      azimuth: -45 + 90 * (app.hubRotation + drag) + (app.hubPlan ? 45 : 0),
      elevation: app.hubPlan ? HUB_PLAN_ELEVATION : app.hubTilt,
      zoom: app.hubZoom,
      panX: app.hubPan[0],
      panZ: app.hubPan[1],
    }),
    [app.hubRotation, drag, app.hubPlan, app.hubTilt, app.hubZoom, app.hubPan],
  );
  const shown = useSmoothHubView(flight?.view ?? userView, reduceMotion);
  const cam = useMemo(() => hubCamera(shown, size, margins), [shown, size, margins]);
  // Los gestos calculan sobre la vista pedida (no la interpolada): sin saltos si llegan a mitad de
  // una transición.
  const live = useRef({ userView, size });
  useLayoutEffect(() => {
    live.current = { userView, size };
  }, [userView, size]);
  const commit = useCallback((v: HubCam) => {
    const c = clampPan(v);
    useApp.getState().set({ hubZoom: c.zoom, hubPan: [c.panX, c.panZ] });
  }, []);
  /** Zoom por `factor` manteniendo quieto un punto de la composición (por defecto, el centro). */
  const zoomBy = useCallback(
    (factor: number, at?: { x: number; y: number }) => {
      const { userView: v, size: s } = live.current;
      commit(zoomAt(v, hubCamera(v, s, margins), factor, at?.x ?? s.width / 2, at?.y ?? s.height / 2));
    },
    [commit, margins],
  );

  // Abrir una estación: la cámara del plano se acerca a la máquina (nítido: es la escena, no una
  // copia ampliada) y la imagen se funde con la estación, que arranca mirando la máquina desde el
  // mismo lado y después orbita hasta su vista.
  const open = useCallback(
    (id: string) => {
      const entry = CATALOG.find((c) => c.id === id);
      if (!entry || opening.current) return;
      if (!entry.ready) {
        useApp.getState().print({ kind: 'out', text: `«${entry.name}» aún no está disponible. Escribe «estaciones» para ver las disponibles.` });
        useApp.getState().set({ consoleOpen: true });
        return;
      }
      const enter = (v: HubCam) => {
        const s = useApp.getState();
        const azimuth = v.azimuth - entry.hub.yaw / DEG;
        const elevation = Math.min(89, v.elevation);
        // Solo si la vista de la estación queda cerca: un barrido de media vuelta desorienta más que ayuda.
        const st = settingsFor(s, id);
        const view = getModule(id)?.content.views.find((w) => w.id === st.viewId);
        const near = view && Math.abs(angleDelta(azimuth, view.azimuth + st.azimuthOffset)) <= 120;
        useApp.setState({ entryCamera: near ? { stationId: id, azimuth, elevation, key: performance.now() } : null, hubSelected: null });
        s.go({ name: 'station', id });
      };
      const from = live.current.userView;
      const canvas = stageRef.current?.querySelector('canvas');
      if (reduceMotion || !canvas) return enter(from);
      opening.current = true;
      const to = focusView(from, hubCorners(entry), live.current.size, margins);
      setFlight({ id, view: to });
      window.setTimeout(() => {
        void crossfadeFrom(canvas, () => enter(to)).finally(() => (opening.current = false));
      }, FLIGHT_MS);
    },
    [reduceMotion, margins],
  );

  /** Clic en una máquina del plano: la elige; si ya estaba elegida, la abre (doble clic o segundo toque). */
  const pick = useCallback(
    (id: string) => {
      if (useApp.getState().hubSelected === id) open(id);
      else useApp.getState().set({ hubSelected: id });
    },
    [open],
  );

  // Movimiento de las máquinas del plano: se puede pausar y cambiar de velocidad. Con «reducir
  // movimiento» empieza en pausa, pero se puede activar.
  const [playPref, setPlaying] = useState<boolean | null>(null);
  const playing = playPref ?? !reduceMotion;
  const [rate, setRate] = useState(1);
  // Oculto: en pausa, sin máquina resaltada ni elegida. Al volver tras abrir una estación, la cámara
  // se aleja desde la máquina hasta la vista que había y la máquina queda destacada un momento.
  useEffect(() => {
    const p = playerRef.current;
    if (!active) {
      p?.pause();
      setHovered(null);
      return;
    }
    if (playing) p?.play();
    else p?.pause();
  }, [active, playing]);
  const flightId = flight?.id;
  useEffect(() => {
    if (!active || !flightId) return;
    setFlight(null);
    setRecent(flightId);
    const t = window.setTimeout(() => setRecent(null), RECENT_MS);
    return () => window.clearTimeout(t);
  }, [active, flightId]);

  // Tamaño real del plano: resolución del lienzo acorde con la pantalla (nítido en pantallas de alta
  // densidad sin pintar de más en las normales) y qué cabe en la barra de vista.
  const [dpr, setDpr] = useState(1);
  const [barSize, setBarSize] = useState<ViewBarSize>('wide');
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e?.contentRect.width ?? 0;
      if (!w) return;
      setDpr(Math.min(2, Math.max(1, Math.round(((w * (window.devicePixelRatio || 1)) / compW) * 4) / 4)));
      setBarSize(w >= 640 ? 'wide' : w >= 420 ? 'narrow' : 'tiny');
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [compW]);

  // Ctrl/⌘ + rueda (y el pellizco del panel táctil, que llega así): zoom bajo el puntero. La rueda
  // sola no se toca (desplaza la página si hace falta).
  const toComp = useCallback(
    (clientX: number, clientY: number) => {
      const r = stageRef.current!.getBoundingClientRect();
      // A pantalla completa la composición queda centrada con bandas: se descuentan.
      const k = Math.min(r.width / compW, r.height / compH);
      return { x: (clientX - r.left - (r.width - compW * k) / 2) / k, y: (clientY - r.top - (r.height - compH * k) / 2) / k, k };
    },
    [compW, compH],
  );
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomBy(Math.exp(-dy * 0.0025), toComp(e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy, toComp]);

  /**
   * Arrastre: sin zoom gira la sala (como antes); con zoom desplaza el plano (Mayús + arrastre sigue
   * girando). Dos dedos: pellizco para el zoom y desplazamiento a la vez.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Cada gesto nuevo (p. ej. al apoyar el segundo dedo) deja sin efecto el anterior.
  const gesture = useRef(0);
  useEffect(() => {
    // Antes que los oyentes de cada gesto: al soltar, el puntero ya no cuenta.
    const release = (e: PointerEvent) => pointers.current.delete(e.pointerId);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const pts = pointers.current;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size > 2) return;
    const token = ++gesture.current;
    setDrag(0);
    // Con dos dedos no hay clic que valga: el gesto es de zoom.
    dragged.current = pts.size === 2;
    const start = [...pts.values()].map((p) => ({ ...p }));
    const v0 = live.current.userView;
    const cam0 = hubCamera(v0, live.current.size, margins);
    const mode = pts.size === 2 ? 'pinch' : v0.zoom > 1.01 && !e.shiftKey ? 'pan' : 'rotate';
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    const move = (ev: PointerEvent) => {
      if (gesture.current !== token) return stop();
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const now = [...pts.values()];
      if (mode === 'pinch') {
        if (now.length < 2 || start.length < 2) return;
        dragged.current = true;
        const mid = (a: { x: number; y: number }[]) => ({ x: (a[0]!.x + a[1]!.x) / 2, y: (a[0]!.y + a[1]!.y) / 2 });
        const dist = (a: { x: number; y: number }[]) => Math.hypot(a[0]!.x - a[1]!.x, a[0]!.y - a[1]!.y) || 1;
        const m0 = toComp(mid(start).x, mid(start).y);
        const m1 = toComp(mid(now).x, mid(now).y);
        const zoomed = zoomAt(v0, cam0, dist(now) / dist(start), m0.x, m0.y);
        commit(panBy(zoomed, hubCamera(zoomed, live.current.size, margins), m1.x - m0.x, m1.y - m0.y));
        return;
      }
      const dx = ev.clientX - start[0]!.x;
      const dy = ev.clientY - start[0]!.y;
      if (!dragged.current && Math.hypot(dx, dy) > 6) dragged.current = true;
      if (!dragged.current) return;
      if (mode === 'pan') {
        const k = toComp(0, 0).k;
        commit(panBy(v0, cam0, dx / k, dy / k));
      } else setDrag(dx / DRAG_PX);
    };
    const up = (ev: PointerEvent) => {
      if (gesture.current !== token) return stop();
      // Un dedo levantado acaba el pellizco; con un solo puntero, acaba al soltarlo.
      if (mode !== 'pinch' && pts.size > 0) return;
      stop();
      if (mode === 'rotate' && dragged.current) {
        // Si el navegador se queda el gesto (desplazamiento), la sala vuelve a su cuarto.
        const quarters = ev.type === 'pointercancel' ? 0 : Math.round((ev.clientX - start[0]!.x) / DRAG_PX);
        setDrag(0);
        useApp.getState().set({ hubRotation: (((useApp.getState().hubRotation + quarters) % 4) + 4) % 4 });
      }
      // El clic llega después del pointerup: se descarta y luego se rearma.
      if (dragged.current) setTimeout(() => (dragged.current = false), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  /** Teclado sobre el plano: flechas eligen la máquina vecina, Intro abre, Esc suelta, + − 0 Q E. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    const s = useApp.getState();
    const arrows: Record<string, 'left' | 'right' | 'up' | 'down'> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
    const items = CATALOG.filter((c) => c.ready).map((c) => {
      const [x, y] = project(cam, hubPoint(c, 0.9));
      return { id: c.id, x, y };
    });
    const centerPick = () => neighbor(items, null, 'left', { x: compW / 2, y: compH / 2 });
    let handled = true;
    if (arrows[e.key]) {
      const from = items.find((i) => i.id === s.hubSelected) ?? null;
      const next = from ? neighbor(items, from, arrows[e.key]!, { x: 0, y: 0 }) : centerPick();
      if (next) s.set({ hubSelected: next });
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (s.hubSelected) open(s.hubSelected);
      else s.set({ hubSelected: centerPick() });
    } else if (e.key === 'Escape' && s.hubSelected) s.set({ hubSelected: null });
    else if (e.key === '+' || e.key === '=') zoomBy(HUB_ZOOM_STEP);
    else if (e.key === '-' || e.key === '_') zoomBy(1 / HUB_ZOOM_STEP);
    else if (e.key === '0') s.resetHubView();
    else if (e.key === 'q' || e.key === 'Q') s.set({ hubRotation: (s.hubRotation + 3) % 4 });
    else if (e.key === 'e' || e.key === 'E') s.set({ hubRotation: (s.hubRotation + 1) % 4 });
    else handled = false;
    if (handled) e.preventDefault();
  };

  const highlight = useMemo(() => {
    const out: Record<string, 'principal' | 'secundario'> = {};
    if (!filter) return out;
    for (const c of CATALOG) {
      const r = roleInStation(c, filter);
      if (r) out[c.id] = r;
    }
    return out;
  }, [filter]);

  const props = useMemo<HubCompProps>(
    () => ({
      theme: app.theme,
      uiScale: narrow ? 1.5 : 1,
      rotation: (shown.azimuth + 45) / 90,
      zoom: shown.zoom,
      view: shown,
      hovered,
      highlight,
      selected: selected ?? recent,
      focus: flight?.id ?? null,
      showLabels: app.hubLabels,
      showZones: app.hubZones,
      embedded: true,
      dpr,
      anthro: app.anthro,
      onSelect: (id: string) => {
        // El clic que cierra un arrastre no elige la máquina que haya debajo.
        if (!dragged.current) pick(id);
      },
      onHover: (id: string | null) => setHovered(id),
      onMiss: () => {
        if (!dragged.current && useApp.getState().hubSelected) useApp.getState().set({ hubSelected: null });
      },
    }),
    [app.theme, shown, app.anthro, app.hubLabels, app.hubZones, hovered, highlight, selected, recent, flight, dpr, narrow, pick],
  );

  const mapActive: Partial<Record<MuscleId, BodyMapEntry>> = {};
  if (filter) mapActive[filter] = { role: 'principal', level: 3 };
  // Vista previa: la estación señalada en el plano o en el índice (ratón o foco), o la elegida.
  const preview = CATALOG.find((c) => c.id === (hovered ?? selected));
  const previewRole = preview && filter ? roleInStation(preview, filter) : null;

  // Tarjeta de la máquina elegida, anclada a ella en el plano: debajo de la máquina o, si la máquina
  // queda abajo del todo, encima de su rótulo.
  const chosen = selected && !flight ? CATALOG.find((c) => c.id === selected) : undefined;
  const card = chosen
    ? (() => {
        const [x, base] = project(cam, hubPoint(chosen, 0));
        const [, top] = project(cam, hubPoint(chosen, hubLabelY(chosen)));
        const below = base / compH < 0.62;
        const role = filter ? roleInStation(chosen, filter) : null;
        return (
          <div
            className={`hud hub-card${below ? ' hub-card--below' : ''}`}
            style={{ left: `clamp(var(--card-half), ${(x / compW) * 100}%, calc(100% - var(--card-half)))`, top: `${((below ? base : top) / compH) * 100}%` }}
            role="group"
            aria-label={`${chosen.name}: estación elegida`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="hub-card__zone">
              {ZONE_LABEL[chosen.zone]}
              {role && <span className={`hub__role hub__role--${role}`}> · {role === 'principal' ? 'motor principal' : 'secundario'}</span>}
            </p>
            <h3 className="hub-card__title">{chosen.name}</h3>
            <p className="hub-card__meta">{chosen.modalidades.join(' · ')}</p>
            <p className="hub-card__meta">
              <em>{chosen.principal.map((m) => MUSCLES[m].name).join(', ')}</em>
            </p>
            <div className="hub-card__actions">
              <button className="hub-card__open" onClick={() => open(chosen.id)}>
                Abrir estación
              </button>
              <button className="icon-btn" onClick={() => app.set({ hubSelected: null })} aria-label="Cerrar la tarjeta" title="Cerrar (Esc)">
                ×
              </button>
            </div>
          </div>
        );
      })()
    : null;

  // Índice de estaciones: sobre el plano (como barra de navegación) o, en móvil, en la columna.
  const index = (
    <nav className={`block hub__index${narrow ? ' hub__index--list' : ''}`} aria-labelledby="hub-index">
      <h2 className="block__title" id="hub-index">
        Estaciones
      </h2>
      <ul className="zones">
        {ZONE_ORDER.map((z) => (
          <li key={z} className="zone">
            <h3 className="zone__title">{ZONE_LABEL[z]}</h3>
            <div className="zone__chips">
              {CATALOG.filter((c) => c.zone === z).map((c) => {
                const role = filter ? roleInStation(c, filter) : null;
                return (
                  <button
                    key={c.id}
                    className={`st-chip${role ? ` st-chip--${role}` : ''}${hovered === c.id || selected === c.id ? ' is-hover' : ''}`}
                    onClick={() => (c.ready ? open(c.id) : undefined)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(c.id)}
                    onBlur={() => setHovered(null)}
                    aria-disabled={!c.ready}
                    title={c.name}
                  >
                    {c.short}
                    {role && <span className="sr-only"> ({role === 'principal' ? 'motor principal' : 'secundario'})</span>}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {/* Hueco fijo: lo que antes contaban las tarjetas (modalidades y músculos) de la estación señalada. */}
      <p className="hub__preview">
        {preview ? (
          <>
            <strong>{preview.name}</strong>
            {previewRole && <span className={`hub__role hub__role--${previewRole}`}> · {previewRole === 'principal' ? 'motor principal' : 'secundario'}</span>} · {preview.modalidades.join(' · ')} ·{' '}
            <em>{preview.principal.map((m) => MUSCLES[m].name).join(', ')}</em>
          </>
        ) : (
          'Señala una estación (aquí o en el plano) para ver sus modalidades y músculos principales.'
        )}
      </p>
    </nav>
  );

  const zoomed = app.hubZoom > 1.01;
  const canFullscreen = typeof document !== 'undefined' && !!document.fullscreenEnabled;

  return (
    <div className={`hub${filter ? ' hub--filtering' : ''}`} hidden={!active}>
      <section className="hub__stage">
        {!narrow && index}
        <div className="hub__plan">
          <div
            ref={stageRef}
            className={`hub__player${zoomed ? ' is-zoomed' : ''}${hovered ? ' is-hovering' : ''}`}
            style={{ '--ar': `${compW} / ${compH}` } as React.CSSProperties}
            tabIndex={0}
            role="group"
            aria-roledescription="plano interactivo"
            aria-label="Plano del gimnasio con las 12 estaciones. Flechas: elegir máquina; Intro: abrirla; Esc: soltarla; + y −: acercar y alejar; Q y E: girar; 0: vista de arranque. También puedes usar el índice de estaciones."
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
          >
            <Player
              ref={playerRef}
              component={HubComposition}
              inputProps={props}
              durationInFrames={8 * FPS}
              compositionWidth={compW}
              compositionHeight={compH}
              fps={FPS}
              loop
              autoPlay={!reduceMotion}
              controls={false}
              clickToPlay={false}
              playbackRate={rate}
              acknowledgeRemotionLicense
              style={{ width: '100%', height: '100%' }}
            />
            {/* Capa con la proporción de la composición (a pantalla completa queda centrada). */}
            <div className="hub__overlay">{card}</div>
            <div onPointerDown={(e) => e.stopPropagation()}>
              <HubViewBar
                size={barSize}
                onZoom={(f) => zoomBy(f)}
                onFullscreen={canFullscreen ? () => void stageRef.current?.requestFullscreen?.().catch(() => undefined) : null}
                playing={playing}
                onPlaying={setPlaying}
                rate={rate}
                onRate={setRate}
              />
            </div>
            <p className="sr-only" aria-live="polite">
              {chosen ? `${chosen.name}, ${ZONE_LABEL[chosen.zone]}. Intro para abrirla; Esc para soltarla.` : ''}
            </p>
          </div>
        </div>
      </section>

      <aside className="hub__side" data-fit="gimnasio">
        <div className="hub__intro">
          <p className="eyebrow">Gimnasio isométrico · 12 estaciones</p>
          <h1>
            Cada articulación, <em>en su sitio</em>.
          </h1>
          <p className="lede">Elige una máquina para ver la técnica fase a fase: ángulos objetivo, rangos seguros, músculos y los errores que conviene evitar.</p>
        </div>

        {narrow && index}

        <section className="hub__filter block" ref={filterRef} tabIndex={-1} aria-labelledby="hub-filter">
          <h2 className="block__title" id="hub-filter">
            Filtrar por músculo
            {filter && (
              <button
                className="link-btn"
                onClick={() => {
                  app.set({ muscleFilter: null });
                  // El botón desaparece: el foco pasa al bloque del filtro en lugar de perderse.
                  filterRef.current?.focus();
                }}
              >
                Quitar filtro
              </button>
            )}
          </h2>
          <select className="select" value={filter ?? ''} onChange={(e) => app.set({ muscleFilter: (e.target.value || null) as MuscleId | null })} aria-label="Músculo">
            <option value="">Todos los músculos</option>
            {FILTER_MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLES[m].name}
              </option>
            ))}
          </select>
          {/* El mapa, si hay alto para él (en ventanas bajas queda el selector). */}
          <BodyMap active={mapActive} selected={filter} onSelect={(m) => app.set({ muscleFilter: filter === m ? null : m })} compact />
          <p className="fine">{filter ? `${MUSCLES[filter].name}: estaciones resaltadas (rojo = motor principal, naranja = secundario).` : 'Pulsa un músculo para resaltar las estaciones que lo trabajan.'}</p>
        </section>
        <p className="disclaimer fine">
          Educativo: no sustituye a un profesional ·{' '}
          <button className="link-btn" onClick={() => app.set({ infoOpen: true })}>
            Fuentes y avisos
          </button>
        </p>
      </aside>
    </div>
  );
}
