import { Player } from '@remotion/player';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MUSCLES, type MuscleId } from '../content/muscles';
import { FPS, type HubCompProps } from '../remotion/props';
import { HubComposition } from '../remotion/HubComposition';
import { CATALOG, ZONE_LABEL, roleInStation, type Zone } from '../stations/catalog';
import { useApp } from '../state/store';
import { BodyMap, type BodyMapEntry } from '../ui/BodyMap';
import { useMedia } from '../ui/useMedia';
import { useSmoothCamera } from '../ui/useSmoothCamera';

/** Píxeles de arrastre por cada giro de 90°. */
const DRAG_PX = 220;
/** Duración del acercamiento a una máquina antes de abrir su estación (ms). */
const FOCUS_MS = 520;

const ZONE_ORDER: Zone[] = ['traccion', 'brazos', 'empuje', 'pierna', 'libre'];

export function HubView() {
  const app = useApp();
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
  // Acercamiento a la máquina elegida; al terminar se abre la estación.
  const [focus, setFocus] = useState<{ id: string; t: number } | null>(null);
  useEffect(() => {
    if (!focus) return;
    if (focus.t >= 1) {
      useApp.getState().go({ name: 'station', id: focus.id });
      return;
    }
    const start = performance.now() - focus.t * FOCUS_MS;
    const raf = requestAnimationFrame((now) => setFocus({ id: focus.id, t: Math.min(1, (now - start) / FOCUS_MS) }));
    return () => cancelAnimationFrame(raf);
  }, [focus]);
  const open = useCallback(
    (id: string) => (reduceMotion ? useApp.getState().go({ name: 'station', id }) : setFocus((f) => f ?? { id, t: 0 })),
    [reduceMotion],
  );

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
      uiScale: narrow ? 1.9 : 1,
      rotation,
      focus,
      zoom: 1,
      hovered,
      highlight,
      anthro: app.anthro,
      onSelect: (id: string) => {
        // El clic que cierra un arrastre de giro no abre la máquina que haya debajo.
        if (dragged.current) return;
        const entry = CATALOG.find((c) => c.id === id);
        if (entry?.ready) open(id);
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
    [app.theme, rotation, focus, app.anthro, hovered, highlight, narrow, open],
  );

  const mapActive: Partial<Record<MuscleId, BodyMapEntry>> = {};
  if (filter) mapActive[filter] = { role: 'principal', level: 3 };

  return (
    <div className={`hub${filter ? ' hub--filtering' : ''}`}>
      <section className="hub__stage">
        <div
          className="hub__player"
          role="img"
          aria-label="Plano del gimnasio con las 12 estaciones; elige una en la lista de abajo"
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
            style={{ width: '100%', aspectRatio: `${compW} / ${compH}` }}
          />
          <div className="hub__rotate">
            <button className="ghost-btn" onClick={() => app.set({ hubRotation: (app.hubRotation + 3) % 4 })} aria-label="Girar a la izquierda">
              ↺
            </button>
            <button className="ghost-btn" onClick={() => app.set({ hubRotation: (app.hubRotation + 1) % 4 })} aria-label="Girar a la derecha">
              ↻
            </button>
          </div>
        </div>
      </section>

      <aside className="hub__side">
          <div className="hub__intro">
          <p className="eyebrow">Gimnasio isométrico · 12 estaciones</p>
          <h1>
            Cada articulación, <em>en su sitio</em>.
          </h1>
          <p className="lede">
            Elige una máquina para ver la técnica fase a fase: ángulos objetivo, rangos seguros, músculos implicados y los errores que conviene evitar.
          </p>
        </div>
        <div className="hub__filter block" ref={filterRef} tabIndex={-1}>
        <h2 className="block__title">
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
        <BodyMap active={mapActive} selected={filter} onSelect={(m) => app.set({ muscleFilter: filter === m ? null : m })} compact />
        <p className="fine">{filter ? `${MUSCLES[filter].name}: estaciones resaltadas (rojo = motor principal, naranja = secundario: sinergista o estabilizador).` : 'Pulsa un músculo para resaltar las estaciones que lo trabajan.'}</p>
        </div>
      </aside>

      <section className="hub__list">
        {ZONE_ORDER.map((z) => (
          <div key={z} className="zone">
            <h2 className="zone__title">{ZONE_LABEL[z]}</h2>
            <div className="zone__cards">
              {CATALOG.filter((c) => c.zone === z).map((c) => {
                const role = filter ? roleInStation(c, filter) : null;
                return (
                  <button
                    key={c.id}
                    className={`card${c.ready ? '' : ' card--soon'}${role ? ` card--${role}` : ''}${hovered === c.id ? ' is-hover' : ''}`}
                    onClick={() => (c.ready ? app.go({ name: 'station', id: c.id }) : undefined)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    aria-disabled={!c.ready}
                  >
                    {/* Con las 12 disponibles, el estado solo se muestra si aporta algo: el papel del músculo filtrado. */}
                    {!c.ready ? (
                      <span className="card__status">Próximamente</span>
                    ) : (
                      role && <span className={`card__status card__status--${role}`}>{role === 'principal' ? 'Motor principal' : 'Secundario'}</span>
                    )}
                    <span className="card__name">{c.name}</span>
                    <span className="card__mods">{c.modalidades.join(' · ')}</span>
                    <span className="card__muscles">{c.principal.map((m) => MUSCLES[m].name).join(', ')}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
