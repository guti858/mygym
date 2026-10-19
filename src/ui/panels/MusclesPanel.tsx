import { MUSCLES, ROLE_LABEL, type MuscleId } from '../../content/muscles';
import type { VariantContent } from '../../engine/types';
import { BodyMap, type BodyMapEntry } from '../BodyMap';

export function MusclesPanel({ variant }: { variant: VariantContent }) {
  const active: Partial<Record<MuscleId, BodyMapEntry>> = {};
  for (const m of variant.muscles) active[m.muscle] = { role: m.role, level: m.level };
  const sorted = [...variant.muscles].sort((a, b) => b.level - a.level);
  return (
    <div className="panel-stack">
      <section className="block">
        <h3 className="block__title">Mapa muscular · {variant.short}</h3>
        <BodyMap active={active} />
        <div className="legend">
          <span><i className="sw sw--p" /> Motor principal</span>
          <span><i className="sw sw--s" /> Sinergista</span>
          <span><i className="sw sw--e" /> Estabilizador</span>
        </div>
      </section>
      <section className="block">
        <ul className="muscles">
          {sorted.map((m) => (
            <li key={m.muscle}>
              <span className={`sw sw--${m.role[0]}`} />
              <span className="muscles__name">{MUSCLES[m.muscle].name}</span>
              <span className="muscles__role">{ROLE_LABEL[m.role]}</span>
              <span className="muscles__lvl" aria-label={`Nivel ${m.level} de 3`}>
                {[1, 2, 3].map((i) => (
                  <i key={i} className={i <= m.level ? 'on' : ''} />
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="fine">Implicación cualitativa (0–3) basada en la literatura y el consenso técnico; no son valores de EMG.</p>
      </section>
    </div>
  );
}
