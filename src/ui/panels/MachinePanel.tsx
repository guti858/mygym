import { useState } from 'react';
import type { SetupLine } from '../../engine/types';
import { useApp } from '../../state/store';

/** Máquina: el ajuste calculado para tu cuerpo y las claves de la estación (fuentes y avisos, en su diálogo). */
export function MachinePanel({ setup, generalCues }: { setup: readonly SetupLine[]; generalCues: readonly string[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const app = useApp();
  return (
    <div className="machine">
      <section className="sec" aria-labelledby="sec-ajuste">
        <h3 className="sec__head" id="sec-ajuste">
          Ajuste de la máquina
          <span className="sec__hint">
            calculado para {app.anthro.heightCm} cm ·{' '}
            <button className="link-btn" onClick={() => app.set({ anthroOpen: true })}>
              cambiar
            </button>
          </span>
        </h3>
        <ul className="setup">
          {setup.map((l) => (
            <li key={l.label} className={done[l.label] ? 'is-done' : ''}>
              <label>
                <input type="checkbox" checked={!!done[l.label]} onChange={(e) => setDone({ ...done, [l.label]: e.target.checked })} />
                <span>
                  <strong>{l.label}</strong> <span className="setup__value">{l.value}</span>
                  {l.note && <span className="fine">{l.note}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <section className="sec" aria-labelledby="sec-claves">
        <h3 className="sec__head" id="sec-claves">
          Claves de la estación
        </h3>
        <ul className="bullets">
          {generalCues.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
