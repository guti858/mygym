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
        <button className="brand" onClick={() => app.go({ name: 'hub' })} aria-label="MyGym · ir al gimnasio">
          <span className="brand__mark" aria-hidden>
            ◢◣
          </span>
          <span className="brand__name">MYGYM</span>
          <span className="brand__sub mono">guion articular</span>
        </button>
        <nav className="crumbs" aria-label="Ruta">
          <button onClick={() => app.go({ name: 'hub' })} className={station ? '' : 'is-on'} aria-current={station ? undefined : 'page'}>
            Gimnasio
          </button>
          {station && (
            <>
              <span aria-hidden>/</span>
              <span className="is-on" aria-current="page">
                {station.name}
              </span>
            </>
          )}
        </nav>
      </div>
      <div className="topbar__actions">
        <button className="ghost-btn" onClick={() => app.set({ anthroOpen: true })} title="Antropometría y movilidad" aria-label={`Tu cuerpo: ${app.anthro.heightCm} cm`}>
          <span aria-hidden>⌖</span> <span className="mono">{app.anthro.heightCm} cm</span>
        </button>
        <div className="theme-switch" role="radiogroup" aria-label="Tema">
          <button role="radio" aria-checked={!app.themeLocked} className={`swatch swatch--auto${!app.themeLocked ? ' is-on' : ''}`} onClick={() => app.chooseTheme('auto')} title="Automático (como el sistema)">
            <span className="sr-only">Automático</span>
          </button>
          {THEMES.map(([id, label]) => {
            const on = app.themeLocked && app.theme === id;
            return (
              <button key={id} role="radio" aria-checked={on} className={`swatch swatch--${id}${on ? ' is-on' : ''}`} onClick={() => app.chooseTheme(id)} title={label}>
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
        <button className="console-btn" onClick={() => app.set({ consoleOpen: !app.consoleOpen })} aria-expanded={app.consoleOpen}>
          <span className="mono">&gt;_</span> Consola <kbd>:</kbd>
        </button>
      </div>
    </header>
  );
}
