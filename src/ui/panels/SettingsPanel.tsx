import { findVariant } from '../../engine/evaluate';
import { describeLoad, loadRange, loadStep, loadValueLabel } from '../../engine/load';
import { parseTempo, type PhaseKind, type Tempo } from '../../engine/timeline';
import type { StationModule } from '../../stations/modules';
import { useApp, type StationSettings } from '../../state/store';
import { KIND_CLASS, PHASE_SHORT } from '../phases';

const TEMPO_FIELDS: Array<[keyof Tempo, PhaseKind, string]> = [
  ['excentrica', 'excentrica', 'Excéntrica (s)'],
  ['pausaEstiramiento', 'pausa_estiramiento', 'Pausa en estiramiento (s)'],
  ['concentrica', 'concentrica', 'Concéntrica (s)'],
  ['pausaContraccion', 'pausa_contraccion', 'Pausa en contracción (s)'],
];

/** Ajustes: lo que se elige antes de mirar (variante, carga y tempo). La vista va en la escena y el error en Técnica. */
export function SettingsPanel({ mod, st }: { mod: StationModule; st: StationSettings }) {
  const id = mod.content.id;
  const app = useApp();
  const variant = findVariant(mod.content, st.variantId);
  const load = mod.logic.load;
  const info = describeLoad(load, st.loadKg, app.anthro.massKg);
  const step = loadStep(load);
  const { min, max } = loadRange(load);
  const shown = loadValueLabel(load, st.loadKg);
  const descId = `variant-desc-${id}`;
  const tempoChanged = TEMPO_FIELDS.some(([k]) => st.tempo[k] !== variant.tempo[k]);

  return (
    <div className="settings">
      <section className="block">
        <h3 className="block__title">Agarre / modalidad</h3>
        <div className="variant-grid" role="radiogroup" aria-label="Variante">
          {mod.content.variants.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={v.id === variant.id}
              aria-describedby={v.id === variant.id ? descId : undefined}
              className={`variant${v.id === variant.id ? ' is-on' : ''}`}
              onClick={() => app.setVariant(id, v.id)}
            >
              {v.short}
            </button>
          ))}
        </div>
        {/* Todas las descripciones apiladas: el bloque mide lo que la más larga y no salta al cambiar. */}
        <div className="variant-desc">
          {mod.content.variants.map((v) => (
            <p key={v.id} id={v.id === variant.id ? descId : undefined} data-on={v.id === variant.id || undefined} aria-hidden={v.id !== variant.id || undefined}>
              {v.description}
            </p>
          ))}
        </div>
      </section>

      <section className="block">
        <h3 className="block__title">
          Carga <span className="block__hint">{load.label}</span>
        </h3>
        <div className="stepper">
          <button className="icon-btn" onClick={() => app.update(id, { loadKg: st.loadKg - step })} aria-label="Menos carga" disabled={st.loadKg <= min}>
            −
          </button>
          <output className="stepper__value mono">
            {shown.value}
            <small> {shown.unit}</small>
          </output>
          <button className="icon-btn" onClick={() => app.update(id, { loadKg: st.loadKg + step })} aria-label="Más carga" disabled={st.loadKg >= max}>
            +
          </button>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={st.loadKg}
          onChange={(e) => app.update(id, { loadKg: Number(e.target.value) })}
          aria-label="Carga"
          aria-valuetext={`${shown.value} ${shown.unit}`}
        />
        <p className="fine">{info.detail}</p>
      </section>

      <section className="block">
        <h3 className="block__title">
          Tempo y serie
          <span className="block__hint">
            s por fase ·{' '}
            <button className="link-btn" onClick={() => app.update(id, { tempo: variant.tempo })} disabled={!tempoChanged} title="Restablecer el tempo recomendado">
              recomendado
            </button>
          </span>
        </h3>
        <div className="tempo">
          {TEMPO_FIELDS.map(([k, phase, label]) => (
            <label key={k} className="tempo__field">
              <span>
                <i className={`dot ${KIND_CLASS[phase]}`} aria-hidden /> {PHASE_SHORT[phase]}
              </span>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={st.tempo[k]}
                aria-label={label}
                onChange={(e) => {
                  const next = { ...st.tempo, [k]: Number(e.target.value) };
                  if (parseTempo(`${next.excentrica}-${next.pausaEstiramiento}-${next.concentrica}-${next.pausaContraccion}`)) app.update(id, { tempo: next });
                }}
              />
            </label>
          ))}
          <label className="tempo__field">
            <span>Reps</span>
            <input type="number" min={1} max={10} value={st.reps} aria-label="Repeticiones" onChange={(e) => app.update(id, { reps: Math.min(10, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
          </label>
        </div>
      </section>

      <p className="disclaimer fine">
        Educativo: no sustituye a un profesional ·{' '}
        <button className="link-btn" onClick={() => app.set({ infoOpen: true })}>
          Fuentes y avisos
        </button>
      </p>
    </div>
  );
}
