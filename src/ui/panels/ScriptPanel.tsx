import { PHASE_LABEL, type PhaseKind } from '../../engine/timeline';
import type { ErrorDef, VariantContent } from '../../engine/types';
import type { FrameState } from '../../remotion/timing';
import type { StationModule } from '../../stations/modules';

const ORDER: Record<'estiramiento' | 'contraccion', PhaseKind[]> = {
  estiramiento: ['preparacion', 'concentrica', 'pausa_contraccion', 'excentrica', 'pausa_estiramiento'],
  contraccion: ['preparacion', 'excentrica', 'pausa_estiramiento', 'concentrica', 'pausa_contraccion'],
};

export function ScriptPanel({ mod, variant, state, error }: { mod: StationModule; variant: VariantContent; state: FrameState; error?: ErrorDef }) {
  const order = ORDER[mod.logic.startAt];
  const cues = variant.cues[state.kind] ?? [];
  const active = cues.length ? Math.min(cues.length - 1, Math.floor(state.u * cues.length)) : -1;
  return (
    <div className="panel-stack">
      {error && (
        <section className="block block--risk">
          <h3 className="block__title">Demostración de error · {error.label}</h3>
          <p>{error.description}</p>
          <p className="fine">
            <strong>Consecuencia:</strong> {error.consequence}
          </p>
        </section>
      )}
      <section className="block block--live">
        <h3 className="block__title">
          Ahora · {PHASE_LABEL[state.kind]}
          <span className="block__hint mono">{state.rep > 0 ? `rep ${state.rep}` : 'colocación'}</span>
        </h3>
        <ol className="cues">
          {cues.map((c, i) => (
            <li key={i} className={i === active ? 'is-active' : ''}>
              {c}
            </li>
          ))}
        </ol>
      </section>
      <section className="block">
        <h3 className="block__title">Guion completo de la repetición</h3>
        <div className="script">
          {order.map((k) => (
            <div key={k} className={`script__phase${k === state.kind ? ' is-current' : ''}`}>
              <div className="script__head">{PHASE_LABEL[k]}</div>
              <ul>
                {(variant.cues[k] ?? []).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <section className="block">
        <h3 className="block__title">Claves de la estación</h3>
        <ul className="bullets">
          {mod.content.generalCues.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
