import { Player } from '@remotion/player';
import { useMemo, useState } from 'react';
import { MUSCLES, type MuscleId } from '../content/muscles';
import { FPS, type HubCompProps } from '../remotion/props';
import { HubComposition } from '../remotion/HubComposition';
import { CATALOG, ZONE_LABEL, roleInStation, type Zone } from '../stations/catalog';
import { useApp } from '../state/store';
import { BodyMap, type BodyMapEntry } from '../ui/BodyMap';
import { useMedia } from '../ui/useMedia';

const ZONE_ORDER: Zone[] = ['traccion', 'brazos', 'empuje', 'pierna', 'libre'];

export function HubView() {
  const app = useApp();
  const [hovered, setHovered] = useState<string | null>(null);
  const narrow = !useMedia('(min-width: 700px)');
  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');
  const [compW, compH] = narrow ? [1000, 1000] : [1600, 900];
  const filter = app.muscleFilter;

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
      rotation: app.hubRotation,
      zoom: 1,
      hovered,
      highlight,
      anthro: app.anthro,
      onSelect: (id: string) => {
        const entry = CATALOG.find((c) => c.id === id);
        if (entry?.ready) useApp.getState().go({ name: 'station', id });
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
    [app.theme, app.hubRotation, app.anthro, hovered, highlight, narrow],
  );

  const mapActive: Partial<Record<MuscleId, BodyMapEntry>> = {};
  if (filter) mapActive[filter] = { role: 'principal', level: 3 };

  return (
    <div className={`hub${filter ? ' hub--filtering' : ''}`}>
      <section className="hub__stage">
        <div className="hub__player">
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
        <div className="hub__filter block">
        <h2 className="block__title">
          Filtrar por músculo
          {filter && (
            <button className="link-btn" onClick={() => app.set({ muscleFilter: null })}>
              Quitar filtro
            </button>
          )}
        </h2>
        <BodyMap active={mapActive} selected={filter} onSelect={(m) => app.set({ muscleFilter: filter === m ? null : m })} compact />
        <p className="fine">{filter ? `${MUSCLES[filter].name}: estaciones resaltadas (rojo = motor principal, naranja = secundario).` : 'Toca un músculo para resaltar las estaciones que lo trabajan.'}</p>
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
