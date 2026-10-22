import { Vector3 } from 'three';
import { HUB_AREAS, HUB_ROUTE, HUB_ZONES, type ZoneRect } from '../scene/layout';
import { CATALOG, ZONE_LABEL, type Zone } from '../stations/catalog';

/** Qué se hace en cada parada del recorrido docente (texto breve, sin pautas de entrenamiento). */
const STEP_TEXT: Record<(typeof HUB_ROUTE)[number]['id'], string> = {
  cardio: 'Para empezar, unos minutos de calentamiento en la cinta o la bicicleta.',
  empuje: 'Empuje: pecho, hombros y tríceps, con barra, máquinas y peso corporal.',
  traccion: 'Tracción: dorsales y espalda alta, con cable, barra y palanca.',
  brazos: 'Brazos: bíceps y tríceps aislados en las poleas.',
  pierna: 'Pierna: cuádriceps, glúteos, aductores y abductores.',
  libre: 'Zona libre: peso libre con mancuernas y, al terminar, estiramientos.',
};

export const TOUR_LENGTH = HUB_ROUTE.length;

/** Rectángulo de suelo de una parada (zona o área sin estación). */
function stepRect(id: (typeof HUB_ROUTE)[number]['id']): ZoneRect {
  return id === 'cardio' ? HUB_AREAS.find((a) => a.id === 'cardio')! : HUB_ZONES[id as Zone];
}

/** Puntos que encuadra la cámara en cada parada: la caja de su zona (con altura de máquina). */
export function tourPoints(step: number): Vector3[] {
  const r = stepRect(HUB_ROUTE[step]!.id);
  const out: Vector3[] = [];
  for (const x of [r.x - r.w / 2, r.x + r.w / 2]) for (const y of [0, 2.2]) for (const z of [r.z - r.d / 2, r.z + r.d / 2]) out.push(new Vector3(x, y, z));
  return out;
}

const stepName = (id: (typeof HUB_ROUTE)[number]['id']) => (id === 'cardio' ? 'Cardio' : ZONE_LABEL[id as Zone]);

/**
 * Panel del recorrido guiado: paso actual, qué se hace ahí, sus estaciones (para abrirlas) y los
 * controles. Avanza solo cada pocos segundos si está en marcha.
 */
export function HubTour({
  step,
  playing,
  onStep,
  onPlaying,
  onExit,
  onOpen,
}: {
  step: number;
  playing: boolean;
  onStep: (step: number) => void;
  onPlaying: (on: boolean) => void;
  onExit: () => void;
  onOpen: (id: string) => void;
}) {
  const { id } = HUB_ROUTE[step]!;
  const stations = id === 'cardio' ? [] : CATALOG.filter((c) => c.zone === id);
  return (
    <section className="hud hub-tour" aria-label="Recorrido guiado" onPointerDown={(e) => e.stopPropagation()}>
      <p className="hub-card__zone">
        Recorrido · paso {step + 1} de {TOUR_LENGTH}
      </p>
      <h3 className="hub-card__title" aria-live="polite">
        {step + 1} · {stepName(id)}
      </h3>
      <p className="hub-card__meta">{STEP_TEXT[id]}</p>
      {stations.length > 0 && (
        <div className="hub-tour__stations">
          {stations.map((c) => (
            <button key={c.id} className="st-chip" onClick={() => onOpen(c.id)} title={`Abrir ${c.name}`}>
              {c.short}
            </button>
          ))}
        </div>
      )}
      <div className="hub-card__actions">
        <button className="icon-btn" onClick={() => onStep(step - 1)} disabled={step === 0} aria-label="Paso anterior" title="Paso anterior">
          ◀
        </button>
        <button className="icon-btn" onClick={() => onPlaying(!playing)} aria-label={playing ? 'Pausar el recorrido' : 'Reanudar el recorrido'} title={playing ? 'Pausar' : 'Reanudar'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <button className="icon-btn" onClick={() => onStep(step + 1)} disabled={step === TOUR_LENGTH - 1} aria-label="Paso siguiente" title="Paso siguiente">
          ▶▶
        </button>
        <button className="hub-card__open" onClick={onExit}>
          Salir
        </button>
      </div>
    </section>
  );
}
