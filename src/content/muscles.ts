/** Catálogo muscular (vocabulario común a todas las estaciones). */
export const MUSCLES = {
  pectoral_clavicular: { name: 'Pectoral mayor (porción clavicular)', group: 'pecho', view: 'anterior' },
  pectoral_esternal: { name: 'Pectoral mayor (porción esternal)', group: 'pecho', view: 'anterior' },
  deltoides_anterior: { name: 'Deltoides anterior', group: 'hombro', view: 'anterior' },
  deltoides_lateral: { name: 'Deltoides lateral', group: 'hombro', view: 'anterior' },
  deltoides_posterior: { name: 'Deltoides posterior', group: 'hombro', view: 'posterior' },
  biceps: { name: 'Bíceps braquial', group: 'brazo', view: 'anterior' },
  braquial: { name: 'Braquial y braquiorradial', group: 'brazo', view: 'anterior' },
  triceps: { name: 'Tríceps braquial', group: 'brazo', view: 'posterior' },
  antebrazo: { name: 'Flexores del antebrazo (agarre)', group: 'brazo', view: 'anterior' },
  dorsal_ancho: { name: 'Dorsal ancho', group: 'espalda', view: 'posterior' },
  redondo_mayor: { name: 'Redondo mayor', group: 'espalda', view: 'posterior' },
  trapecio_superior: { name: 'Trapecio superior', group: 'espalda', view: 'posterior' },
  trapecio_medio: { name: 'Trapecio medio y romboides', group: 'espalda', view: 'posterior' },
  trapecio_inferior: { name: 'Trapecio inferior', group: 'espalda', view: 'posterior' },
  serrato: { name: 'Serrato anterior', group: 'pecho', view: 'anterior' },
  erectores: { name: 'Erectores espinales', group: 'core', view: 'posterior' },
  abdominales: { name: 'Recto abdominal y oblicuos', group: 'core', view: 'anterior' },
  gluteo_mayor: { name: 'Glúteo mayor', group: 'pierna', view: 'posterior' },
  gluteo_medio: { name: 'Glúteo medio y menor', group: 'pierna', view: 'posterior' },
  cuadriceps: { name: 'Cuádriceps', group: 'pierna', view: 'anterior' },
  isquiotibiales: { name: 'Isquiotibiales', group: 'pierna', view: 'posterior' },
  aductores: { name: 'Aductores', group: 'pierna', view: 'anterior' },
  gastrocnemio: { name: 'Gastrocnemio (gemelos)', group: 'pierna', view: 'posterior' },
  soleo: { name: 'Sóleo', group: 'pierna', view: 'posterior' },
} as const;

export type MuscleId = keyof typeof MUSCLES;
export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

export type MuscleRole = 'principal' | 'sinergista' | 'estabilizador';

export const ROLE_LABEL: Record<MuscleRole, string> = {
  principal: 'Motor principal',
  sinergista: 'Sinergista',
  estabilizador: 'Estabilizador',
};

export const MUSCLE_GROUP_LABEL = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombro: 'Hombro',
  brazo: 'Brazo',
  core: 'Core',
  pierna: 'Pierna',
} as const;
