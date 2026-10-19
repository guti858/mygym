import type { MuscleId, MuscleRole } from '../content/muscles';
import { MUSCLES } from '../content/muscles';

type Shape =
  | { t: 'e'; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { t: 'r'; x: number; y: number; w: number; h: number }
  | { t: 'p'; d: string };

/** Regiones musculares (lado izquierdo de la figura; se reflejan en x = 60). */
const FRONT: Partial<Record<MuscleId, Shape[]>> = {
  pectoral_clavicular: [{ t: 'e', cx: 49, cy: 49, rx: 9.5, ry: 4, rot: -8 }],
  pectoral_esternal: [{ t: 'e', cx: 49, cy: 59, rx: 10.5, ry: 6.5, rot: 4 }],
  deltoides_anterior: [{ t: 'e', cx: 35.5, cy: 47, rx: 4.5, ry: 6.5, rot: 22 }],
  deltoides_lateral: [{ t: 'e', cx: 30.5, cy: 50, rx: 3.5, ry: 6.5, rot: 8 }],
  biceps: [{ t: 'e', cx: 29, cy: 70, rx: 4.3, ry: 10.5, rot: 8 }],
  braquial: [{ t: 'e', cx: 26.3, cy: 88, rx: 3.2, ry: 4.6, rot: 8 }],
  antebrazo: [{ t: 'e', cx: 23.2, cy: 112, rx: 3.6, ry: 12, rot: 8 }],
  serrato: [{ t: 'e', cx: 40.5, cy: 74, rx: 3, ry: 7.5, rot: -6 }],
  abdominales: [{ t: 'r', x: 52, y: 70, w: 7.5, h: 40 }],
  cuadriceps: [{ t: 'e', cx: 46.5, cy: 172, rx: 7.6, ry: 23, rot: 3 }],
  aductores: [{ t: 'e', cx: 55.2, cy: 161, rx: 3.6, ry: 14, rot: -6 }],
};

const BACK: Partial<Record<MuscleId, Shape[]>> = {
  trapecio_superior: [{ t: 'p', d: 'M56 30 L39 42 L57 45 Z' }],
  trapecio_medio: [{ t: 'e', cx: 51.5, cy: 54, rx: 7.5, ry: 5.5, rot: 6 }],
  trapecio_inferior: [{ t: 'e', cx: 55.5, cy: 71, rx: 3.6, ry: 10, rot: 10 }],
  deltoides_posterior: [{ t: 'e', cx: 35.5, cy: 47.5, rx: 4.5, ry: 6.5, rot: -22 }],
  deltoides_lateral: [{ t: 'e', cx: 30.5, cy: 50, rx: 3.5, ry: 6.5, rot: 8 }],
  redondo_mayor: [{ t: 'e', cx: 40.5, cy: 61, rx: 4, ry: 3.2, rot: -15 }],
  dorsal_ancho: [{ t: 'e', cx: 45, cy: 82, rx: 8.5, ry: 15.5, rot: 12 }],
  triceps: [{ t: 'e', cx: 29, cy: 72, rx: 4.4, ry: 11.5, rot: 8 }],
  erectores: [{ t: 'r', x: 54.5, y: 82, w: 5, h: 34 }],
  gluteo_medio: [{ t: 'e', cx: 44, cy: 127, rx: 6.5, ry: 4.6, rot: -10 }],
  gluteo_mayor: [{ t: 'e', cx: 50.5, cy: 141, rx: 9.5, ry: 8.5 }],
  isquiotibiales: [{ t: 'e', cx: 48, cy: 177, rx: 7, ry: 21 }],
  gastrocnemio: [{ t: 'e', cx: 47, cy: 212, rx: 5.2, ry: 11 }],
  soleo: [{ t: 'e', cx: 48, cy: 232, rx: 3.8, ry: 8.5 }],
};

function Silhouette() {
  const limb = { stroke: 'var(--body-fill)', strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <g>
      <circle cx={60} cy={17} r={10.5} fill="var(--body-fill)" />
      <rect x={55} y={26} width={10} height={10} rx={3} fill="var(--body-fill)" />
      <path d="M37 38 L83 38 L79 96 L76 128 L82 146 L38 146 L44 128 L41 96 Z" fill="var(--body-fill)" />
      {[1, -1].map((s) => (
        <g key={s} transform={s === -1 ? 'translate(120 0) scale(-1 1)' : undefined}>
          <line x1={32} y1={44} x2={26.5} y2={99} strokeWidth={11} {...limb} />
          <line x1={26.5} y1={99} x2={21.5} y2={139} strokeWidth={8.5} {...limb} />
          <line x1={21.5} y1={139} x2={20} y2={150} strokeWidth={6.5} {...limb} />
          <line x1={48} y1={142} x2={47} y2={204} strokeWidth={17} {...limb} />
          <line x1={47} y1={204} x2={48} y2={250} strokeWidth={11} {...limb} />
          <line x1={48} y1={254} x2={42} y2={258} strokeWidth={6} {...limb} />
        </g>
      ))}
    </g>
  );
}

function ShapeEl({ s }: { s: Shape }) {
  if (s.t === 'e') return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} />;
  if (s.t === 'r') return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={2.5} />;
  return <path d={s.d} />;
}

export interface BodyMapEntry {
  role: MuscleRole;
  level: number;
}

const ROLE_VAR: Record<MuscleRole, string> = {
  principal: 'var(--m-principal)',
  sinergista: 'var(--m-sinergista)',
  estabilizador: 'var(--m-estab)',
};

export function BodyMap({
  active,
  selected,
  onSelect,
  compact,
}: {
  active: Partial<Record<MuscleId, BodyMapEntry>>;
  selected?: MuscleId | null;
  onSelect?: (m: MuscleId) => void;
  compact?: boolean;
}) {
  const views: Array<['Frente' | 'Espalda', Partial<Record<MuscleId, Shape[]>>]> = [
    ['Frente', FRONT],
    ['Espalda', BACK],
  ];
  return (
    <div className={`bodymap${compact ? ' bodymap--compact' : ''}`}>
      {views.map(([label, shapes]) => (
        <figure key={label}>
          <svg viewBox="0 0 120 262" role="img" aria-label={`Mapa muscular (${label.toLowerCase()})`}>
            <Silhouette />
            {(Object.keys(shapes) as MuscleId[]).map((m) => {
              const a = active[m];
              const isSel = selected === m;
              const fill = a ? ROLE_VAR[a.role] : 'var(--body-region)';
              const opacity = a ? 0.45 + 0.18 * a.level : 1;
              return (
                <g
                  key={m}
                  className={`bm-region${onSelect ? ' bm-region--clickable' : ''}${isSel ? ' bm-region--selected' : ''}`}
                  fill={fill}
                  fillOpacity={opacity}
                  onClick={onSelect ? () => onSelect(m) : undefined}
                  role={onSelect ? 'button' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-label={onSelect ? MUSCLES[m].name : undefined}
                  onKeyDown={onSelect ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelect(m) : undefined}
                >
                  <title>{MUSCLES[m].name}</title>
                  {shapes[m]!.map((s, i) => (
                    <g key={i}>
                      <ShapeEl s={s} />
                      <g transform="translate(120 0) scale(-1 1)">
                        <ShapeEl s={s} />
                      </g>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
          <figcaption>{label}</figcaption>
        </figure>
      ))}
    </div>
  );
}
