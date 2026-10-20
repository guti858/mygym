import type { PlayerRef } from '@remotion/player';
import { PHASE_LABEL, type PhaseKind, type Timeline as TL } from '../engine/timeline';
import type { FrameState } from '../remotion/timing';

const KIND_CLASS: Record<PhaseKind, string> = {
  preparacion: 'k-prep',
  excentrica: 'k-exc',
  pausa_estiramiento: 'k-pe',
  concentrica: 'k-con',
  pausa_contraccion: 'k-pc',
};

export function Timeline({
  timeline,
  state,
  frame,
  fps,
  player,
  playing,
  rate,
  onRate,
  reps,
}: {
  timeline: TL;
  state: FrameState;
  frame: number;
  fps: number;
  player: PlayerRef | null;
  playing: boolean;
  rate: number;
  onRate: (r: number) => void;
  reps: number;
}) {
  const total = timeline.total;
  const t = frame / fps;
  const seek = (sec: number) => player?.seekTo(Math.min(Math.round(sec * fps), Math.ceil(total * fps) - 1));
  const go = (delta: number) => {
    const i = Math.min(timeline.segments.length - 1, Math.max(0, state.index + delta));
    player?.pause();
    seek(timeline.segments[i]!.start + 0.001);
  };
  return (
    <div className="timeline">
      <div className="timeline__controls">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Fase anterior" title="Fase anterior">
          ⏮
        </button>
        <button className="icon-btn icon-btn--primary" onClick={() => player?.toggle()} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Fase siguiente" title="Fase siguiente">
          ⏭
        </button>
        <div className="timeline__phase">
          <span className={`dot ${KIND_CLASS[state.kind]}`} />
          <strong>{PHASE_LABEL[state.kind]}</strong>
          <span className="muted mono">{state.rep > 0 ? `rep ${state.rep}/${reps}` : 'colocación'}</span>
        </div>
        <label className="timeline__rate">
          <span className="sr-only">Velocidad</span>
          <select value={rate} onChange={(e) => onRate(Number(e.target.value))}>
            {[0.25, 0.5, 1, 1.5, 2].map((r) => (
              <option key={r} value={r}>
                ×{r}
              </option>
            ))}
          </select>
        </label>
        <span className="mono muted timeline__clock">
          {t.toFixed(1)} / {total.toFixed(1)} s
        </span>
      </div>
      <div
        className="timeline__track"
        role="slider"
        aria-label="Posición en la serie"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(t)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') go(1);
          if (e.key === 'ArrowLeft') go(-1);
        }}
        onPointerDown={(e) => {
          const el = e.currentTarget;
          const rect = el.getBoundingClientRect();
          const at = (clientX: number) => seek(((clientX - rect.left) / rect.width) * total);
          at(e.clientX);
          const move = (ev: PointerEvent) => at(ev.clientX);
          const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
          };
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
        }}
      >
        {timeline.segments.map((s, i) => (
          <div
            key={i}
            className={`timeline__seg ${KIND_CLASS[s.kind]}${i === state.index ? ' is-active' : ''}`}
            style={{ left: `${(s.start / total) * 100}%`, width: `${((s.end - s.start) / total) * 100}%` }}
            title={`${PHASE_LABEL[s.kind]}${s.rep ? ` · rep ${s.rep}` : ''}`}
          />
        ))}
        <div className="timeline__head" style={{ left: `${(t / total) * 100}%` }} />
      </div>
      <div className="timeline__legend">
        <span className="timeline__tip">Arrastra la escena para girarla · doble clic: pantalla completa</span>
        {(['preparacion', 'excentrica', 'pausa_estiramiento', 'concentrica', 'pausa_contraccion'] as PhaseKind[]).map((k) => (
          <span key={k}>
            <span className={`dot ${KIND_CLASS[k]}`} /> {PHASE_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
