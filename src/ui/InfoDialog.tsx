import { useEffect, useRef } from 'react';
import { CONFIDENCE_LABEL } from '../engine/types';
import { getModule } from '../stations/modules';
import { useApp } from '../state/store';

/**
 * «Fuentes y avisos»: lo que antes estaba repartido entre el pie de página, la pestaña Máquina y las
 * notas del mapa muscular (fuentes de la estación, nivel de confianza, descargo y créditos).
 */
export function InfoDialog() {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (app.infoOpen && !d.open) d.showModal();
    if (!app.infoOpen && d.open) d.close();
  }, [app.infoOpen]);
  const mod = app.route.name === 'station' ? getModule(app.route.id) : undefined;
  return (
    <dialog ref={ref} className="dialog dialog--wide" onClose={() => app.set({ infoOpen: false })} aria-labelledby="info-title">
      <form method="dialog" className="dialog__body">
        <header className="dialog__head">
          <h2 id="info-title">Fuentes y avisos</h2>
          <button className="icon-btn" aria-label="Cerrar">
            ✕
          </button>
        </header>
        {mod && (
          <section>
            <h3 className="sec__head">{mod.content.name}</h3>
            <p>{mod.content.summary}</p>
            <ol className="sources">
              {mod.content.sources.map((s) => (
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
            <p className="fine">Cada ventana articular indica su nivel de confianza: {Object.values(CONFIDENCE_LABEL).join(' · ')}.</p>
          </section>
        )}
        <section>
          <h3 className="sec__head">Aviso</h3>
          <p>
            Contenido educativo basado en literatura y consenso técnico. No sustituye la valoración de un profesional sanitario o del ejercicio, y debe adaptarse a lesiones previas. La implicación muscular
            es cualitativa (0–3), no son valores de EMG; la demanda articular es un momento estático estimado.
          </p>
        </section>
        <section>
          <h3 className="sec__head">Créditos</h3>
          <p className="fine">
            Modelo anatómico propio de MyGym (hombre y mujer), generado por código: esqueleto paramétrico, músculos por fibras y piel por campos de distancia, deformado con el rig de
            MyGym. Animación con Remotion · 3D con three.js.
          </p>
        </section>
      </form>
    </dialog>
  );
}
