import { Player, type PlayerRef } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEG } from '../engine/math';
import { MUSCLES, type MuscleId } from '../content/muscles';
import { FPS, type HubCompProps } from '../remotion/props';
import { HubComposition } from '../remotion/HubComposition';
import { CATALOG, ZONE_LABEL, roleInStation, type Zone } from '../stations/catalog';
import { getModule } from '../stations/modules';
import { settingsFor, useApp } from '../state/store';
import { BodyMap, type BodyMapEntry } from '../ui/BodyMap';
import { useMedia } from '../ui/useMedia';
import { angleDelta, useSmoothCamera } from '../ui/useSmoothCamera';
import { zoomInto } from '../ui/zoomTransition';

/** Píxeles de arrastre por cada giro de 90°. */
const DRAG_PX = 220;
/** Elevación de la cámara isométrica del gimnasio. */
const HUB_ELEVATION = 35.264;

const ZONE_ORDER: Zone[] = ['traccion', 'brazos', 'empuje', 'pierna', 'libre'];
/** Músculos que trabaja alguna estación, por orden alfabético (selector del filtro). */
const FILTER_MUSCLES = [...new Set(CATALOG.flatMap((c) => [...c.principal, ...c.secundarios]))].sort((a, b) => MUSCLES[a].name.localeCompare(MUSCLES[b].name, 'es'));

/**
 * Gimnasio. Se queda montado (oculto y en pausa) mientras se ve una estación: al volver no se
 * recrea el contexto WebGL ni se recompilan los shaders.
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
  const filter = app.muscleFilter;
  // Giro de la sala: arrastre libre que al soltar se ajusta al cuarto de vuelta más cercano, y
  // transición animada entre cuartos (con «reducir movimiento», directa).
  const [drag, setDrag] = useState(0);
  const dragged = useRef(false);
  const goal = useMemo(() => ({ azimuth: -45 + 90 * (app.hubRotation + drag), elevation: 0 }), [app.hubRotation, drag]);
  const shown = useSmoothCamera(goal, reduceMotion);
  const rotation = (shown.azimuth + 45) / 90;
  // Abrir una estación desde el plano: la copia del plano se acerca a la máquina (en el compositor,
  // sin tirones) mientras la estación se monta debajo. La estación arranca mirando la máquina desde
  // el mismo lado que en el plano y después orbita hasta su vista.
  const open = useCallback(
    (id: string, point?: { x: number; y: number }) => {
      const entry = CATALOG.find((c) => c.id === id);
      if (!entry || opening.current) return;
      const enter = () => {
        const s = useApp.getState();
        const azimuth = -45 + 90 * s.hubRotation - entry.hub.yaw / DEG;
        // Solo si la vista de la estación queda cerca: un barrido de media vuelta desorienta más que ayuda.
        const st = settingsFor(s, id);
        const view = getModule(id)?.content.views.find((v) => v.id === st.viewId);
        const near = view && Math.abs(angleDelta(azimuth, view.azimuth + st.azimuthOffset)) <= 120;
        useApp.setState({ entryCamera: near ? { stationId: id, azimuth, elevation: HUB_ELEVATION, key: performance.now() } : null });
        s.go({ name: 'station', id });
      };
      const canvas = stageRef.current?.querySelector('canvas');
      if (reduceMotion || !point || !canvas) return enter();
      opening.current = true;
      const r = canvas.getBoundingClientRect();
      void zoomInto(canvas, { x: r.left + point.x * r.width, y: r.top + point.y * r.height }, enter).finally(() => (opening.current = false));
    },
    [reduceMotion],
  );
  // Oculto: en pausa y sin máquina resaltada; al volver, sigue la animación.
  useEffect(() => {
    const p = playerRef.current;
    if (!active) {
      p?.pause();
      setHovered(null);
    } else if (!reduceMotion) p?.play();
  }, [active, reduceMotion]);

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
      rotation,
      zoom: 1,
      hovered,
      highlight,
      anthro: app.anthro,
      onSelect: (id: string, point?: { x: number; y: number }) => {
        // El clic que cierra un arrastre de giro no abre la máquina que haya debajo.
        if (dragged.current) return;
        const entry = CATALOG.find((c) => c.id === id);
        if (entry?.ready) open(id, point);
        else {
          useApp.getState().print({ kind: 'out', text: `«${entry?.name}» aún no está disponible. Escribe «estaciones» para ver las disponibles.` });
          useApp.getState().set({ consoleOpen: true });
        }
      },
      onHover: (id: string | null) => {
        setHovered(id);
        document.body.style.cursor = id ? 'pointer' : '';
      },
    }),
    [app.theme, rotation, app.anthro, hovered, highlight, narrow, open],
  );

  const mapActive: Partial<Record<MuscleId, BodyMapEntry>> = {};
  if (filter) mapActive[filter] = { role: 'principal', level: 3 };
  // Vista previa: la estación señalada en el plano o en el índice (ratón o foco).
  const preview = hovered ? CATALOG.find((c) => c.id === hovered) : undefined;
  const previewRole = preview && filter ? roleInStation(preview, filter) : null;

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
                    className={`st-chip${role ? ` st-chip--${role}` : ''}${hovered === c.id ? ' is-hover' : ''}`}
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

  return (
    <div className={`hub${filter ? ' hub--filtering' : ''}`} hidden={!active}>
      <section className="hub__stage">
        {!narrow && index}
        <div className="hub__plan">
          <div
            ref={stageRef}
            className="hub__player"
            style={{ '--ar': `${compW} / ${compH}` } as React.CSSProperties}
            role="img"
            aria-label="Plano del gimnasio con las 12 estaciones; elige una en el índice de estaciones"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const startX = e.clientX;
              dragged.current = false;
              const move = (ev: PointerEvent) => {
                const dx = ev.clientX - startX;
                if (Math.abs(dx) > 6) dragged.current = true;
                if (dragged.current) setDrag(dx / DRAG_PX);
              };
              const up = (ev: PointerEvent) => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
                window.removeEventListener('pointercancel', up);
                if (dragged.current) {
                  // Si el navegador se queda el gesto (desplazamiento), la sala vuelve a su cuarto.
                  const quarters = ev.type === 'pointercancel' ? 0 : Math.round((ev.clientX - startX) / DRAG_PX);
                  setDrag(0);
                  useApp.getState().set({ hubRotation: (((useApp.getState().hubRotation + quarters) % 4) + 4) % 4 });
                  // El clic llega después del pointerup: se descarta y luego se rearma.
                  setTimeout(() => (dragged.current = false), 0);
                }
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
              window.addEventListener('pointercancel', up);
            }}
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
              acknowledgeRemotionLicense
              style={{ width: '100%', height: '100%' }}
            />
            <div className="hud hub__rotate">
              <button className="hud__btn" onClick={() => app.set({ hubRotation: (app.hubRotation + 3) % 4 })} aria-label="Girar a la izquierda" title="Girar a la izquierda">
                ↺
              </button>
              <button className="hud__btn" onClick={() => app.set({ hubRotation: (app.hubRotation + 1) % 4 })} aria-label="Girar a la derecha" title="Girar a la derecha">
                ↻
              </button>
            </div>
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
          Contenido educativo: no sustituye la valoración de un profesional.{' '}
          <button className="link-btn" onClick={() => app.set({ infoOpen: true })}>
            Fuentes y avisos
          </button>
        </p>
      </aside>
    </div>
  );
}
