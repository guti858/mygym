import { useEffect, useRef, useState } from 'react';
import { completions, runCommand } from '../state/commands';
import { useApp } from '../state/store';

function commonPrefix(xs: string[]): string {
  if (!xs.length) return '';
  let p = xs[0]!;
  for (const x of xs) while (!x.startsWith(p)) p = p.slice(0, -1);
  return p;
}

export function Console() {
  const app = useApp();
  const [line, setLine] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const prompt = app.route.name === 'station' ? `mygym:${app.route.id}$` : 'mygym$';
  const suggestions = line ? completions(line).slice(0, 8) : [];

  useEffect(() => {
    if (!app.consoleOpen) return;
    // Al cerrar, el foco vuelve a donde estaba (o al botón «Consola»), no al <body>.
    const prev = document.activeElement as HTMLElement | null;
    input.current?.focus();
    return () => {
      const back = prev && prev !== document.body && prev.isConnected ? prev : document.querySelector<HTMLElement>('.console-btn');
      back?.focus();
    };
  }, [app.consoleOpen]);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [app.log, app.consoleOpen]);

  if (!app.consoleOpen) return null;
  return (
    <section className="console" aria-label="Consola de comandos">
      <header className="console__head">
        <span className="mono">&gt;_ terminal</span>
        <span className="muted mono">Tab completa · ↑↓ historial · Esc cierra</span>
        <button className="icon-btn" onClick={() => app.set({ consoleOpen: false })} aria-label="Cerrar consola">
          ✕
        </button>
      </header>
      <div className="console__log mono" ref={log} role="log" aria-live="polite">
        {app.log.map((l, i) => (
          <div key={i} className={`ln ln--${l.kind}`}>
            {l.kind === 'in' ? <span className="ln__prompt">›</span> : null}
            {l.text}
          </div>
        ))}
      </div>
      <form
        className="console__input mono"
        onSubmit={(e) => {
          e.preventDefault();
          runCommand(line);
          if (line.trim()) setHistory([line, ...history].slice(0, 50));
          setHIdx(-1);
          setLine('');
        }}
      >
        <label htmlFor="console-input" className="console__prompt">
          {prompt}
        </label>
        <input
          id="console-input"
          ref={input}
          aria-label="Comando"
          value={line}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setLine(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') app.set({ consoleOpen: false });
            // Tab completa si hay algo escrito; con la línea vacía (o con Mayús) sale del campo.
            if (e.key === 'Tab' && !e.shiftKey && line) {
              e.preventDefault();
              const c = completions(line);
              if (c.length === 1) setLine(`${c[0]} `);
              else if (c.length > 1) setLine(commonPrefix(c));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              const i = Math.min(history.length - 1, hIdx + 1);
              if (i >= 0) {
                setHIdx(i);
                setLine(history[i]!);
              }
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              const i = hIdx - 1;
              setHIdx(Math.max(-1, i));
              setLine(i >= 0 ? history[i]! : '');
            }
          }}
        />
      </form>
      {suggestions.length > 0 && (
        <div className="console__suggest mono">
          {suggestions.map((s) => (
            <button key={s} onClick={() => { setLine(`${s} `); input.current?.focus(); }}>
              {s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
