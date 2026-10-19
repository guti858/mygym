import { useEffect, useRef } from 'react';
import { ANTHRO_TEST_PROFILES, computeSegments, type Anthropometry } from '../engine/anthropometry';
import { useApp } from '../state/store';

const FIELDS: Array<{ key: keyof Anthropometry; label: string; min: number; max: number; step: number; unit: string; hint?: string }> = [
  { key: 'heightCm', label: 'Talla', min: 140, max: 210, step: 1, unit: 'cm' },
  { key: 'massKg', label: 'Masa corporal', min: 40, max: 160, step: 1, unit: 'kg' },
  { key: 'armRatio', label: 'Longitud de brazos', min: 0.94, max: 1.06, step: 0.01, unit: '×', hint: 'relativa a tu talla' },
  { key: 'femurRatio', label: 'Longitud de fémur', min: 0.94, max: 1.06, step: 0.01, unit: '×', hint: 'relativa a tu talla' },
  { key: 'torsoRatio', label: 'Longitud de tronco', min: 0.94, max: 1.06, step: 0.01, unit: '×', hint: 'relativa a tu talla' },
  { key: 'hipFlexionMax', label: 'Flexión de cadera máxima', min: 80, max: 140, step: 1, unit: '°', hint: 'antes de que la pelvis bascule' },
  { key: 'ankleDorsiMax', label: 'Flexión dorsal de tobillo', min: 15, max: 55, step: 1, unit: '°', hint: 'rodilla flexionada (test de la pared)' },
];

const PRESETS: Array<[string, string]> = [
  ['p5', 'Pequeña (150 cm)'],
  ['p50', 'Media (175 cm)'],
  ['p95', 'Grande (195 cm)'],
  ['femurLargo', 'Fémur largo'],
  ['rigido', 'Poca movilidad'],
];

export function AnthroPanel() {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (app.anthroOpen && !d.open) d.showModal();
    if (!app.anthroOpen && d.open) d.close();
  }, [app.anthroOpen]);
  const a = app.anthro;
  const seg = computeSegments(a);
  const cm = (m: number) => `${Math.round(m * 100)} cm`;
  return (
    <dialog ref={ref} className="dialog" onClose={() => app.set({ anthroOpen: false })} aria-labelledby="anthro-title">
      <form method="dialog" className="dialog__body">
        <header className="dialog__head">
          <h2 id="anthro-title">Tu cuerpo</h2>
          <button className="icon-btn" aria-label="Cerrar">
            ✕
          </button>
        </header>
        <p className="fine">Las palancas y la movilidad cambian el ajuste de cada máquina y la profundidad segura. Se guardan solo en este navegador.</p>
        <div className="presets">
          {PRESETS.map(([id, label]) => (
            <button type="button" key={id} className="chip" onClick={() => app.setAnthro(ANTHRO_TEST_PROFILES[id]!)}>
              {label}
            </button>
          ))}
        </div>
        <div className="fields">
          {FIELDS.map((f) => (
            <label key={f.key} className="field">
              <span className="field__label">
                {f.label}
                {f.hint && <small> · {f.hint}</small>}
              </span>
              <input type="range" min={f.min} max={f.max} step={f.step} value={a[f.key]} onChange={(e) => app.setAnthro({ [f.key]: Number(e.target.value) })} />
              <output className="mono">
                {a[f.key]}
                {f.unit}
              </output>
            </label>
          ))}
        </div>
        <div className="segments mono">
          <span>muslo {cm(seg.thigh)}</span>
          <span>pierna {cm(seg.shank)}</span>
          <span>brazo {cm(seg.upperArm)}</span>
          <span>antebrazo {cm(seg.forearm)}</span>
          <span>tronco {cm(seg.lumbar + seg.thoracic)}</span>
        </div>
      </form>
    </dialog>
  );
}
