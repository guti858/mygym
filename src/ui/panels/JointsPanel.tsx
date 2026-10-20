import { windowActive } from '../../engine/evaluate';
import { JOINT_MOMENT_LABEL, type JointMomentId } from '../../engine/moments';
import type { PhaseKind } from '../../engine/timeline';
import { CONFIDENCE_LABEL, type Evaluation, type JointWindow, type Status } from '../../engine/types';
import { deg, num } from '../format';

const ICON: Record<Status, string> = { ok: '✔', aviso: '▲', riesgo: '✖' };
const AT_LABEL = { contraccion: 'se evalúa en la contracción', estiramiento: 'se evalúa en el estiramiento', movimiento: 'se evalúa en movimiento', siempre: '' };

function RangeBar({ w, values }: { w: JointWindow; values: Array<{ v: number; s: Status }> }) {
  const span = w.warn[1] - w.warn[0];
  const lo = w.warn[0] - span * 0.25;
  const hi = w.warn[1] + span * 0.25;
  const pct = (x: number) => `${((Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="range" aria-hidden>
      <div className="range__warn" style={{ left: pct(w.warn[0]), right: `calc(100% - ${pct(w.warn[1])})` }} />
      <div className="range__ok" style={{ left: pct(w.ok[0]), right: `calc(100% - ${pct(w.ok[1])})` }} />
      {values.map((x, i) => (
        <div key={i} className={`range__mark s-${x.s}`} style={{ left: pct(x.v) }} />
      ))}
    </div>
  );
}

export function JointsPanel({
  windows,
  evaluations,
  p,
  phase,
  moments,
  momentMax,
}: {
  windows: readonly JointWindow[];
  evaluations: readonly Evaluation[];
  p: number;
  phase: PhaseKind;
  moments: Record<JointMomentId, number>;
  momentMax: number;
}) {
  return (
    <div className="panel-stack">
      <section className="block">
        <h3 className="block__title">
          Ventanas articulares <span className="block__hint">en vivo</span>
        </h3>
        <ul className="joints">
          {windows.map((w) => {
            const ev = evaluations.filter((e) => e.window.id === w.id);
            const live = windowActive(w, p, phase) && ev.length > 0;
            const worst = ev.reduce<Status>((acc, e) => (e.status === 'riesgo' || (e.status === 'aviso' && acc === 'ok') ? e.status : acc), 'ok');
            return (
              <li key={w.id} className={`joint ${live ? `s-${worst}` : 'is-idle'}`}>
                <div className="joint__head">
                  <span className="joint__icon" aria-hidden>
                    {live ? ICON[worst] : '·'}
                  </span>
                  <span className="joint__label">{w.label}</span>
                  <span className="joint__value mono">
                    {live ? ev.map((e) => deg(e.value)).join(' · ') : '—'}
                  </span>
                </div>
                <RangeBar w={w} values={live ? ev.map((e) => ({ v: e.value, s: e.status })) : []} />
                <p className="joint__cue">{w.cue}</p>
                <p className="joint__meta">
                  Correcto {num(w.ok[0])}…{num(w.ok[1])}° · {CONFIDENCE_LABEL[w.confidence]}
                  {w.at !== 'siempre' && ` · ${AT_LABEL[w.at]}`}
                </p>
                {live && worst !== 'ok' && <p className="joint__why">{w.why}</p>}
              </li>
            );
          })}
        </ul>
      </section>
      <section className="block">
        <h3 className="block__title">
          Demanda articular estimada <span className="block__hint">momento estático, N·m</span>
        </h3>
        <ul className="moments">
          {(Object.keys(moments) as JointMomentId[])
            .filter((k) => moments[k] > 0.5)
            .map((k) => (
              <li key={k}>
                <span>{JOINT_MOMENT_LABEL[k]}</span>
                <div className="moments__bar">
                  <div style={{ width: `${Math.min(100, (moments[k] / Math.max(1, momentMax)) * 100)}%` }} />
                </div>
                <span className="mono">{moments[k].toFixed(0)}</span>
              </li>
            ))}
        </ul>
        <p className="fine">Fuerza de la máquina × brazo de palanca respecto a cada articulación. No incluye inercia ni el peso de los segmentos.</p>
      </section>
    </div>
  );
}
