import { findVariant } from '../../engine/evaluate';
import { describeLoad, loadRange, loadStep, loadValueLabel } from '../../engine/load';
import { parseTempo, type Tempo } from '../../engine/timeline';
import type { StationModule } from '../../stations/modules';
import { useApp, type StationSettings } from '../../state/store';

/** Rótulos cortos para los botones de vista (el nombre completo va en el título). */
const VIEW_SHORT: Record<string, string> = { 'Desde los pies': 'Pies', 'Rodillas (desde la cabeza)': 'Rodillas' };

const TEMPO_FIELDS: Array<[keyof Tempo, string, string]> = [
  ['excentrica', 'Exc.', 'Excéntrica (s)'],
  ['pausaEstiramiento', 'P. est.', 'Pausa en estiramiento (s)'],
  ['concentrica', 'Conc.', 'Concéntrica (s)'],
  ['pausaContraccion', 'P. cont.', 'Pausa en contracción (s)'],
];

export function SettingsPanel({ mod, st }: { mod: StationModule; st: StationSettings }) {
  const id = mod.content.id;
  const app = useApp();
  const variant = findVariant(mod.content, st.variantId);
  const load = mod.logic.load;
  const info = describeLoad(load, st.loadKg, app.anthro.massKg);
  const step = loadStep(load);
  const { min, max } = loadRange(load);
  const shown = loadValueLabel(load, st.loadKg);

  return (
    <div className="panel-stack">
      <section className="block">
        <h3 className="block__title">Agarre / modalidad</h3>
        <div className="variant-list" role="radiogroup" aria-label="Variante">
          {mod.content.variants.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={v.id === variant.id}
              className={`variant${v.id === variant.id ? ' is-on' : ''}`}
              onClick={() => app.setVariant(id, v.id)}
            >
              <span className="variant__name">{v.short}</span>
              <span className="variant__desc">{v.description}</span>
            </button>
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
        <h3 className="block__title">Demostrar un error</h3>
        <div className="chip-list">
          <button className={`chip${st.errorId === null ? ' is-on is-ok' : ''}`} aria-pressed={st.errorId === null} onClick={() => app.update(id, { errorId: null })}>
            ✔ Técnica ideal
          </button>
          {variant.errors.map((eid) => {
            const e = mod.content.errors.find((x) => x.id === eid)!;
            return (
              <button key={eid} className={`chip${st.errorId === eid ? ' is-on is-risk' : ''}`} aria-pressed={st.errorId === eid} onClick={() => app.update(id, { errorId: eid })} title={e.description}>
                ✖ {e.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="block">
        <h3 className="block__title">
          Tempo y serie <span className="block__hint">segundos por fase</span>
        </h3>
        <div className="tempo">
          {TEMPO_FIELDS.map(([k, short, label]) => (
            <label key={k} className="tempo__field">
              <span>{short}</span>
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
        <button className="link-btn" onClick={() => app.update(id, { tempo: variant.tempo })}>
          Restablecer tempo recomendado
        </button>
      </section>

      <section className="block">
        <h3 className="block__title">Vista</h3>
        <div className="segmented" role="radiogroup" aria-label="Vista de cámara">
          {mod.content.views.map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={st.viewId === v.id}
              aria-label={v.label}
              title={v.label}
              className={st.viewId === v.id ? 'is-on' : ''}
              onClick={() => app.update(id, { viewId: v.id, azimuthOffset: 0 })}
            >
              {VIEW_SHORT[v.label] ?? v.label}
            </button>
          ))}
        </div>
        <div className="row-gap">
          <button className="ghost-btn" onClick={() => app.update(id, { azimuthOffset: st.azimuthOffset - 30 })}>
            ↺ 30°
          </button>
          <button className="ghost-btn" onClick={() => app.update(id, { azimuthOffset: st.azimuthOffset + 30 })}>
            ↻ 30°
          </button>
          <button className="ghost-btn" onClick={() => app.update(id, { zoom: Math.min(2.2, st.zoom * 1.15) })} aria-label="Acercar">
            +
          </button>
          <button className="ghost-btn" onClick={() => app.update(id, { zoom: Math.max(0.6, st.zoom / 1.15) })} aria-label="Alejar">
            −
          </button>
        </div>
        <div className="toggles">
          <label>
            <input type="checkbox" checked={app.showMuscles} onChange={(e) => app.set({ showMuscles: e.target.checked })} /> Músculos
          </label>
          <label>
            <input type="checkbox" checked={app.showGauges} onChange={(e) => app.set({ showGauges: e.target.checked })} /> Ángulos
          </label>
          <label>
            <input type="checkbox" checked={app.showOverlay} onChange={(e) => app.set({ showOverlay: e.target.checked })} /> Rótulos
          </label>
        </div>
      </section>
    </div>
  );
}
