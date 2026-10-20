import type { PlayerRef } from '@remotion/player';
import { useEffect, useId, useState } from 'react';
import { STATUS_RANK, WINDOW_AT_TEXT, errorMoment, errorWindows, startAtOf, windowActive } from '../../engine/evaluate';
import { JOINT_MOMENT_LABEL, type JointMomentId } from '../../engine/moments';
import { PHASE_LABEL, type PhaseKind, type Timeline } from '../../engine/timeline';
import { CONFIDENCE_LABEL, type ErrorDef, type Evaluation, type JointWindow, type Status, type VariantContent } from '../../engine/types';
import { frameState, phaseEntry, type FrameState } from '../../remotion/timing';
import type { StationModule } from '../../stations/modules';
import { useApp, type StationSettings } from '../../state/store';
import { deg, num } from '../format';
import { KIND_CLASS, PHASE_ORDER, PHASE_SHORT } from '../phases';

const ICON: Record<Status, string> = { ok: '✔', aviso: '▲', riesgo: '✖' };
/** Cuándo se evalúa una ventana que ahora no está en juego (en lugar de un guion vacío). */
const AT_SHORT: Record<JointWindow['at'], string> = { contraccion: 'en contracción', estiramiento: 'en estiramiento', movimiento: 'en movimiento', siempre: '—' };
const MOMENT_KEYS = Object.keys(JOINT_MOMENT_LABEL) as JointMomentId[];

function RangeBar({ w, values }: { w: JointWindow; values: Array<{ v: number; s: Status }> }) {
  const span = w.warn[1] - w.warn[0];
  const lo = w.warn[0] - span * 0.25;
  const hi = w.warn[1] + span * 0.25;
  const pct = (x: number) => `${((Math.min(hi, Math.max(lo, x)) - lo) / (hi - lo)) * 100}%`;
  return (
    <span className="range" aria-hidden>
      <span className="range__warn" style={{ left: pct(w.warn[0]), right: `calc(100% - ${pct(w.warn[1])})` }} />
      <span className="range__ok" style={{ left: pct(w.ok[0]), right: `calc(100% - ${pct(w.ok[1])})` }} />
      {values.map((x, i) => (
        <span key={i} className={`range__mark s-${x.s}`} style={{ left: pct(x.v) }} />
      ))}
    </span>
  );
}

/** Pauta y motivo de una ventana articular: tarjeta flotante sobre la lista (no empuja nada). */
function JointDetail({ w, id, onClose }: { w: JointWindow; id: string; onClose: () => void }) {
  return (
    <div className="jdetail" id={id} role="region" aria-label={`Pauta: ${w.label}`}>
      <p className="jdetail__head">
        <strong>{w.label}</strong>
        <button className="icon-btn jdetail__close" onClick={onClose} aria-label="Cerrar pauta">
          ✕
        </button>
      </p>
      <p>
        <strong>Corrige:</strong> {w.cue}
      </p>
      <p>
        <strong>Por qué:</strong> {w.why}
      </p>
      <p className="muted">
        Correcto {num(w.ok[0])}…{num(w.ok[1])}° · {CONFIDENCE_LABEL[w.confidence].toLowerCase()} · se evalúa {WINDOW_AT_TEXT[w.at]}.
      </p>
    </div>
  );
}

/**
 * Técnica: lo que antes eran Guion, «Demostrar un error» y Articulaciones. Arriba se elige el modo
 * (técnica ideal o un error), en medio el guion dinámico de la fase y abajo las articulaciones, con
 * la pauta correctora. Todos los huecos de altura variable están reservados: nada se mueve al
 * cambiar de fase.
 */
export function TechniquePanel({
  mod,
  st,
  variant,
  timeline,
  state,
  fps,
  evaluations,
  moments,
  momentMax,
  numbers,
  player,
}: {
  mod: StationModule;
  st: StationSettings;
  variant: VariantContent;
  timeline: Timeline;
  state: FrameState;
  fps: number;
  evaluations: readonly Evaluation[];
  moments: Record<JointMomentId, number>;
  momentMax: number;
  /** Número de la insignia de cada métrica en la escena (sin ángulos en la escena, ninguno). */
  numbers: ReadonlyMap<string, number> | null;
  player: PlayerRef | null;
}) {
  const app = useApp();
  const id = mod.content.id;
  const [measure, setMeasure] = useState<'angulos' | 'momentos'>('angulos');
  const [selected, setSelected] = useState<string | null>(null);
  const detailId = useId();
  // Esc cierra la pauta abierta.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);
  const error: ErrorDef | undefined = st.errorId ? mod.content.errors.find((e) => e.id === st.errorId) : undefined;
  const order = PHASE_ORDER[startAtOf(mod.logic, variant.id)];

  const seek = (frame: number) => {
    player?.pause();
    player?.seekTo(frame);
  };
  const goPhase = (k: PhaseKind) => {
    const segs = timeline.segments.filter((s) => s.kind === k);
    const seg = segs.find((s) => s.rep === (k === 'preparacion' ? 0 : state.rep || 1)) ?? segs[0];
    if (seg) seek(Math.round(phaseEntry(seg, fps) * fps));
  };
  // Primer tramo de la primera repetición en el que se evalúa alguna ventana afectada por el error.
  const goError = () => {
    if (!error) return;
    const ws = errorWindows(variant, error);
    const rep = timeline.segments.filter((s) => s.rep === 1);
    if (!rep.length || !ws.length) return;
    const f0 = Math.round(rep[0]!.start * fps);
    const f1 = Math.round(rep[rep.length - 1]!.end * fps);
    let start = -1;
    let end = f1;
    for (let f = f0; f < f1; f++) {
      const fs = frameState(f, fps, timeline);
      const on = ws.some((w) => windowActive(w, fs.p, fs.kind));
      if (on && start < 0) start = f;
      else if (!on && start >= 0) {
        end = f;
        break;
      }
    }
    if (start >= 0) seek(Math.round((start + end) / 2));
  };

  // Guion: la pauta activa avanza con la fase solo si da tiempo a leerla (≥ 1,2 s por pauta).
  const cues = variant.cues[state.kind] ?? [];
  const readable = (state.endFrame - state.startFrame) / Math.max(1, cues.length) >= 1.2 * fps;
  const activeCue = cues.length ? (readable ? Math.min(cues.length - 1, Math.floor(state.u * cues.length)) : 0) : -1;

  const rows = variant.windows.map((w) => {
    const ev = evaluations.filter((e) => e.window.id === w.id);
    const live = windowActive(w, state.p, state.kind) && ev.length > 0;
    const status = ev.reduce<Status>((acc, e) => (STATUS_RANK[e.status] > STATUS_RANK[acc] ? e.status : acc), 'ok');
    return { w, ev, live, status, affected: !!error && error.expect.includes(w.metric) };
  });
  // El error nunca aparece sin su corrección: la pauta de la primera articulación que afecta.
  const fix = error ? errorWindows(variant, error)[0] : undefined;

  return (
    <div className="technique">
      <section className="sec" aria-labelledby="sec-error">
        <h3 className="sec__head" id="sec-error">
          Demostrar un error
        </h3>
        <div className="chip-list">
          <button className={`chip${st.errorId === null ? ' is-on is-ok' : ''}`} aria-pressed={st.errorId === null} onClick={() => app.update(id, { errorId: null })}>
            ✔ Técnica ideal
          </button>
          {variant.errors.map((eid) => {
            const e = mod.content.errors.find((x) => x.id === eid)!;
            return (
              <button key={eid} className={`chip${st.errorId === eid ? ' is-on is-risk' : ''}`} aria-pressed={st.errorId === eid} onClick={() => app.update(id, { errorId: eid })}>
                ✖ {e.label}
              </button>
            );
          })}
        </div>
        {error ? (
          <div className="callout callout--risk">
            <h4 className="sr-only">Demostración de error · {error.label}</h4>
            <p>
              <strong>Qué se ve:</strong> {error.description}
            </p>
            <p>
              <strong>Por qué importa:</strong> {error.consequence}
            </p>
            {fix && (
              <p>
                <strong>Corrige:</strong> {fix.cue}
              </p>
            )}
            <p className="callout__foot">
              <span>Se ve {errorMoment(variant, error)}.</span>
              <button className="link-btn" onClick={goError}>
                Ir al momento
              </button>
            </p>
          </div>
        ) : (
          <p className="callout">Compara la técnica ideal con un error típico: verás qué articulaciones salen de rango y cómo corregirlo.</p>
        )}
      </section>

      <section className="sec" aria-labelledby="sec-guion">
        <h3 className="sec__head" id="sec-guion">
          Guion <span className="sec__hint">pulsa una fase para ir a ella</span>
        </h3>
        <div className="phase-rail" role="group" aria-label="Fases de la repetición: elige una para ir a ella">
          {order.map((k) => {
            const exists = timeline.segments.some((s) => s.kind === k);
            return (
              <button
                key={k}
                className={`phase-pill${k === state.kind ? ' is-on' : ''}`}
                aria-current={k === state.kind ? 'step' : undefined}
                aria-label={PHASE_LABEL[k]}
                title={exists ? PHASE_LABEL[k] : `${PHASE_LABEL[k]} (0 s en este tempo)`}
                disabled={!exists}
                onClick={() => goPhase(k)}
              >
                <span className={`dot ${KIND_CLASS[k]}`} aria-hidden /> {PHASE_SHORT[k]}
              </button>
            );
          })}
        </div>
        {/* Todas las fases apiladas en la misma celda: el bloque mide siempre lo que la más larga. */}
        <div className="cues-stack">
          {order.map((k) => (
            <ol key={k} className="cues" data-on={k === state.kind || undefined} aria-hidden={k !== state.kind || undefined}>
              {(variant.cues[k] ?? []).map((c, i) => (
                <li key={i} className={k === state.kind && i === activeCue ? 'is-active' : ''}>
                  {c}
                </li>
              ))}
            </ol>
          ))}
        </div>
      </section>

      <section className="sec sec--joints" aria-labelledby="sec-art">
        <h3 className="sec__head" id="sec-art">
          Articulaciones
          <span className="mini-seg" role="radiogroup" aria-label="Medida">
            <button role="radio" aria-checked={measure === 'angulos'} className={measure === 'angulos' ? 'is-on' : ''} onClick={() => setMeasure('angulos')}>
              Ángulos
            </button>
            <button role="radio" aria-checked={measure === 'momentos'} className={measure === 'momentos' ? 'is-on' : ''} onClick={() => setMeasure('momentos')} title="Demanda articular estimada (momento estático, N·m)">
              N·m
            </button>
          </span>
        </h3>
        {measure === 'angulos' ? (
          <ul className="joints">
            {rows.map(({ w, ev, live, status, affected }) => {
              const n = numbers?.get(w.metric);
              return (
                <li key={w.id} className={`joint ${live ? `s-${status}` : 'is-idle'}${affected ? ' is-affected' : ''}`}>
                  <button
                    className={`joint__btn${selected === w.id ? ' is-sel' : ''}`}
                    aria-expanded={selected === w.id}
                    aria-controls={selected === w.id ? detailId : undefined}
                    onClick={() => setSelected(selected === w.id ? null : w.id)}
                  >
                    <span className="joint__n" aria-hidden>
                      {n ?? ''}
                    </span>
                    <span className="joint__icon" aria-hidden>
                      {live ? ICON[status] : '·'}
                    </span>
                    <span className="joint__label">
                      {w.label}
                      {affected && <span className="sr-only"> (afectada por el error)</span>}
                    </span>
                    <RangeBar w={w} values={live ? ev.map((e) => ({ v: e.value, s: e.status })) : []} />
                    <span className="joint__value mono">{live ? ev.map((e) => deg(e.value)).join(' · ') : AT_SHORT[w.at]}</span>
                  </button>
                  {selected === w.id && <JointDetail w={w} id={detailId} onClose={() => setSelected(null)} />}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="moments">
            {MOMENT_KEYS.map((k) => (
              <li key={k}>
                <span>{JOINT_MOMENT_LABEL[k]}</span>
                <span className="moments__bar">
                  <span style={{ width: `${Math.min(100, (moments[k] / Math.max(1, momentMax)) * 100)}%` }} />
                </span>
                <span className="mono">{moments[k].toFixed(0)} N·m</span>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">
          {measure === 'angulos'
            ? 'Pulsa una fila para ver cómo se corrige y por qué.'
            : 'Momento estático estimado: fuerza × brazo de palanca, sin inercia ni peso de los segmentos.'}
        </p>
      </section>
    </div>
  );
}
