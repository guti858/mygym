import type { MuscleId, MuscleRole } from '../content/muscles';
import { MUSCLES } from '../content/muscles';
import { BODYMAP, type BodyMapBase, type BodyMapViewPaths } from './bodymap.generated';

/**
 * Mapa muscular 2D: proyecciones frontal y dorsal del mismo modelo anatómico que usan las
 * animaciones 3D (trazados generados por scripts/anatomy/bodymap-svg.ts). Cada región incluye
 * los dos lados del cuerpo.
 */

export interface BodyMapEntry {
  role: MuscleRole;
  level: number;
}

const ROLE_VAR: Record<MuscleRole, string> = {
  principal: 'var(--m-principal)',
  sinergista: 'var(--m-sinergista)',
  estabilizador: 'var(--m-estab)',
};

const VIEWS: ReadonlyArray<readonly ['Frente' | 'Espalda', BodyMapViewPaths]> = [
  ['Frente', BODYMAP.front],
  ['Espalda', BODYMAP.back],
];

/** Partes no seleccionables, de atrás adelante (no se solapan: el orden solo afecta al trazo). */
const BASE_ORDER: readonly BodyMapBase[] = ['hueso', 'piel', 'otros'];

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
  return (
    <div className={`bodymap${compact ? ' bodymap--compact' : ''}`}>
      {VIEWS.map(([label, view]) => {
        const outline = selected ? view.regions[selected] : undefined;
        return (
          <figure key={label}>
            <svg viewBox={BODYMAP.viewBox} role={onSelect ? 'group' : 'img'} aria-label={`Mapa muscular (${label.toLowerCase()})`}>
              <path className="bm-silhouette" d={view.silhouette} />
              {BASE_ORDER.map((b) => {
                const d = view.base[b];
                return d ? <path key={b} className={`bm-base bm-base--${b}`} d={d} /> : null;
              })}
              {(Object.keys(view.regions) as MuscleId[]).map((m) => {
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
                    aria-pressed={onSelect ? isSel : undefined}
                    onKeyDown={
                      onSelect
                        ? (e) => {
                            if (e.key !== 'Enter' && e.key !== ' ') return;
                            e.preventDefault();
                            onSelect(m);
                          }
                        : undefined
                    }
                  >
                    <title>{MUSCLES[m].name}</title>
                    <path d={view.regions[m]} />
                  </g>
                );
              })}
              {/* Contorno de la selección encima de todo (los vecinos taparían medio trazo). */}
              {outline && <path className="bm-outline" d={outline} aria-hidden="true" />}
            </svg>
            <figcaption>{label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
