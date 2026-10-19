import { useState } from 'react';
import { CONFIDENCE_LABEL, type SetupLine, type Source } from '../../engine/types';
import { useApp } from '../../state/store';

export function MachinePanel({ setup, sources }: { setup: readonly SetupLine[]; sources: readonly Source[] }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const app = useApp();
  const a = app.anthro;
  return (
    <div className="panel-stack">
      <section className="block">
        <h3 className="block__title">
          Ajuste de la máquina <span className="block__hint">calculado para tu cuerpo</span>
        </h3>
        <ul className="setup">
          {setup.map((l) => (
            <li key={l.label} className={done[l.label] ? 'is-done' : ''}>
              <label>
                <input type="checkbox" checked={!!done[l.label]} onChange={(e) => setDone({ ...done, [l.label]: e.target.checked })} />
                <span>
                  <strong>{l.label}</strong>
                  <span className="setup__value">{l.value}</span>
                  {l.note && <span className="fine">{l.note}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="profile-line">
          <span className="mono">
            {a.heightCm} cm · {a.massKg} kg · cadera {a.hipFlexionMax}° · tobillo {a.ankleDorsiMax}°
          </span>
          <button className="link-btn" onClick={() => app.set({ anthroOpen: true })}>
            Editar perfil
          </button>
        </div>
      </section>
      <section className="block">
        <h3 className="block__title">Fuentes</h3>
        <ol className="sources">
          {sources.map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.cite}
                </a>
              ) : (
                s.cite
              )}
            </li>
          ))}
        </ol>
        <p className="fine">
          Cada ventana indica su nivel de confianza: {Object.values(CONFIDENCE_LABEL).join(' · ')}. Contenido educativo: no sustituye la valoración de un profesional sanitario o del
          ejercicio, y debe adaptarse a lesiones previas.
        </p>
      </section>
    </div>
  );
}
