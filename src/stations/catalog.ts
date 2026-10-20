import type { MuscleId } from '../content/muscles';
import type { StationContent } from '../engine/types';

export type Zone = StationContent['zone'];

export const ZONE_LABEL: Record<Zone, string> = {
  empuje: 'Empuje',
  traccion: 'Tracción',
  brazos: 'Brazos',
  pierna: 'Pierna',
  libre: 'Zona libre',
};

export type PlaceholderKind = 'torre' | 'banco' | 'pila' | 'poleas' | 'remo' | 'rack';

export interface CatalogEntry {
  id: string;
  name: string;
  short: string;
  zone: Zone;
  /** Implementada (true) o pendiente de un lote posterior de F4. */
  ready: boolean;
  /** Músculos principales y secundarios (para el filtro del hub). */
  principal: readonly MuscleId[];
  secundarios: readonly MuscleId[];
  modalidades: readonly string[];
  hub: { x: number; z: number; yaw: number };
  placeholder: PlaceholderKind;
}

/** Las 12 estaciones del gimnasio. Las no implementadas muestran una silueta en el hub. */
export const CATALOG: readonly CatalogEntry[] = [
  {
    id: 'dominadas',
    short: 'Dominadas',
    name: 'Barra de dominadas',
    zone: 'traccion',
    ready: true,
    principal: ['dorsal_ancho'],
    secundarios: ['biceps', 'redondo_mayor', 'trapecio_inferior', 'braquial', 'antebrazo'],
    modalidades: ['Prona ancha', 'Supina', 'Neutra', 'Asistida / lastrada'],
    hub: { x: -7.6, z: -4.2, yaw: 0 },
    placeholder: 'torre',
  },
  {
    id: 'jalon',
    short: 'Jalón al pecho',
    name: 'Jalón al pecho',
    zone: 'traccion',
    ready: true,
    principal: ['dorsal_ancho'],
    secundarios: ['redondo_mayor', 'trapecio_medio', 'trapecio_inferior', 'biceps', 'braquial'],
    modalidades: ['Prono ancho', 'Supino', 'Neutro (V)'],
    hub: { x: -4.7, z: -4.2, yaw: 0 },
    placeholder: 'pila',
  },
  {
    id: 'remo_t',
    short: 'Remo en T',
    name: 'Remo en T',
    zone: 'traccion',
    ready: true,
    principal: ['dorsal_ancho', 'trapecio_medio'],
    secundarios: ['deltoides_posterior', 'biceps', 'erectores', 'redondo_mayor'],
    modalidades: ['Con apoyo de pecho', 'Libre (bisagra)', 'Neutro estrecho', 'Prono ancho'],
    hub: { x: -1.8, z: -4.2, yaw: 0 },
    placeholder: 'remo',
  },
  {
    id: 'poleas',
    short: 'Poleas',
    name: 'Poleas (bíceps / tríceps)',
    zone: 'brazos',
    ready: true,
    principal: ['biceps', 'triceps'],
    secundarios: ['braquial', 'antebrazo', 'abdominales'],
    modalidades: ['Curl con barra', 'Curl martillo con cuerda', 'Tríceps polea alta', 'Tríceps sobre la cabeza'],
    hub: { x: 1.4, z: -4.4, yaw: 0 },
    placeholder: 'poleas',
  },
  {
    id: 'prensa',
    short: 'Prensa 45°',
    name: 'Prensa de piernas 45°',
    zone: 'pierna',
    ready: true,
    principal: ['cuadriceps', 'gluteo_mayor'],
    secundarios: ['aductores', 'isquiotibiales', 'gastrocnemio', 'soleo'],
    modalidades: ['Pies medios', 'Pies altos', 'Pies bajos', 'Pies anchos', 'Gemelo'],
    hub: { x: 5.0, z: -4.0, yaw: -Math.PI / 2 },
    placeholder: 'pila',
  },
  {
    id: 'abd_add',
    short: 'Abd. / aduct.',
    name: 'Abductores / aductores',
    zone: 'pierna',
    ready: true,
    principal: ['gluteo_medio', 'aductores'],
    secundarios: ['gluteo_mayor'],
    modalidades: ['Abducción', 'Aducción', 'Respaldo vertical / inclinado'],
    hub: { x: 7.9, z: -1.6, yaw: -Math.PI / 2 },
    placeholder: 'pila',
  },
  {
    id: 'press_banca',
    short: 'Press de banca',
    name: 'Press de banca con barra',
    zone: 'empuje',
    ready: true,
    principal: ['pectoral_esternal'],
    secundarios: ['pectoral_clavicular', 'deltoides_anterior', 'triceps', 'serrato'],
    modalidades: ['Agarre medio', 'Agarre cerrado', 'Agarre ancho'],
    hub: { x: -7.4, z: 0.6, yaw: 0 },
    placeholder: 'banco',
  },
  {
    id: 'press_inclinado',
    short: 'Press inclinado',
    name: 'Press inclinado de pecho (máquina)',
    zone: 'empuje',
    ready: true,
    principal: ['pectoral_clavicular'],
    secundarios: ['deltoides_anterior', 'triceps', 'serrato'],
    modalidades: ['Prono', 'Neutro'],
    hub: { x: -4.5, z: 0.6, yaw: 0 },
    placeholder: 'pila',
  },
  {
    id: 'press_militar',
    short: 'Press militar',
    name: 'Press militar (máquina)',
    zone: 'empuje',
    ready: true,
    principal: ['deltoides_anterior', 'deltoides_lateral'],
    secundarios: ['triceps', 'trapecio_superior', 'serrato'],
    modalidades: ['Prono', 'Neutro'],
    hub: { x: -1.6, z: 0.6, yaw: 0 },
    placeholder: 'pila',
  },
  {
    id: 'peck_deck',
    short: 'Peck-deck',
    name: 'Peck-deck',
    zone: 'empuje',
    ready: true,
    principal: ['pectoral_esternal', 'deltoides_posterior'],
    secundarios: ['pectoral_clavicular', 'deltoides_anterior', 'trapecio_medio'],
    modalidades: ['Aperturas (pecho)', 'Pájaro invertido (deltoides posterior)'],
    hub: { x: 1.3, z: 0.6, yaw: 0 },
    placeholder: 'pila',
  },
  {
    id: 'fondos',
    short: 'Fondos',
    name: 'Máquina de fondos',
    zone: 'empuje',
    ready: true,
    principal: ['pectoral_esternal', 'triceps'],
    secundarios: ['deltoides_anterior', 'pectoral_clavicular'],
    modalidades: ['Pectoral', 'Tríceps', 'Libre / asistida / lastrada'],
    hub: { x: -6.0, z: 4.6, yaw: 0 },
    placeholder: 'torre',
  },
  {
    id: 'mancuernas',
    short: 'Mancuernas',
    name: 'Rack de mancuernas',
    zone: 'libre',
    ready: true,
    principal: ['biceps', 'deltoides_lateral', 'isquiotibiales'],
    secundarios: ['pectoral_clavicular', 'dorsal_ancho', 'cuadriceps', 'gluteo_mayor', 'deltoides_anterior'],
    modalidades: ['Curl', 'Press hombro', 'Elevaciones laterales', 'Remo unilateral', 'Press inclinado', 'Peso muerto rumano', 'Sentadilla goblet'],
    hub: { x: 6.1, z: 4.5, yaw: 0 },
    placeholder: 'rack',
  },
];

export const catalogEntry = (id: string) => CATALOG.find((c) => c.id === id);

/** Papel que tiene un músculo en una estación (para resaltar en el hub). */
export function roleInStation(entry: CatalogEntry, muscle: MuscleId): 'principal' | 'secundario' | null {
  if (entry.principal.includes(muscle)) return 'principal';
  if (entry.secundarios.includes(muscle)) return 'secundario';
  return null;
}
