import type { ThemeId } from '../scene/palette';
import { catalogEntry } from '../stations/catalog';
import { useApp } from '../state/store';

const THEMES: Array<[ThemeId, string]> = [
  ['oscuro', 'Oscuro'],
  ['claro', 'Claro'],
  ['terminal', 'Terminal'],
];

export function Header() {
  const app = useApp();
  const station = app.route.name === 'station' ? catalogEntry(app.route.id) : undefined;
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <button className="brand" onClick={() => app.go({ name: 'hub' })} aria-label="Ir al gimnasio">
          <span className="brand__mark" aria-hidden>
            ◢◣
          </span>
          <span className="brand__name">MYGYM</span>
          <span className="brand__sub mono">guion articular</span>
        </button>
        <nav className="crumbs" aria-label="Ruta">
          <button onClick={() => app.go({ name: 'hub' })} className={station ? '' : 'is-on'}>
            Gimnasio
          </button>
          {station && (
            <>
              <span aria-hidden>/</span>
              <span className="is-on">{station.name}</span>
            </>
          )}
        </nav>
      </div>
      <div className="topbar__actions">
        <button className="ghost-btn" onClick={() => app.set({ anthroOpen: true })} title="Antropometría y movilidad">
          <span aria-hidden>⌖</span> <span className="mono">{app.anthro.heightCm} cm</span>
        </button>
        <div className="theme-switch" role="radiogroup" aria-label="Tema">
          {THEMES.map(([id, label]) => (
            <button key={id} role="radio" aria-checked={app.theme === id} className={`swatch swatch--${id}${app.theme === id ? ' is-on' : ''}`} onClick={() => app.set({ theme: id })} title={label}>
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
        <button className="console-btn" onClick={() => app.set({ consoleOpen: !app.consoleOpen })} aria-expanded={app.consoleOpen}>
          <span className="mono">&gt;_</span> Consola <kbd>:</kbd>
        </button>
      </div>
    </header>
  );
}
