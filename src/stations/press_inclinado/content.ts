import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE, SHARED_WINDOWS } from '../common';

const aperturaCodos = (ok: readonly [number, number], warn: readonly [number, number], texto: string): JointWindow => ({
  id: 'apertura_codos',
  metric: 'shoulder.abd',
  ok,
  warn,
  at: 'estiramiento',
  label: 'Apertura de codos',
  cue: texto,
  why: 'Con los codos a 90° del tronco («en T») aumenta el estrés en la parte anterior del hombro sin ganar trabajo de pectoral.',
  confidence: 'consenso',
  sources: ['nsca', 'trebs2010'],
});

const W = {
  codosTronco: {
    id: 'codos_tronco',
    metric: 'shoulder.behind',
    ok: [-90, 15],
    warn: [-90, 25],
    at: 'estiramiento',
    label: 'Codos no muy por detrás del tronco',
    cue: 'Abajo, los codos solo un poco por detrás del cuerpo: el estiramiento del pecho no se fuerza.',
    why: 'Llevar los codos muy atrás estira la cápsula anterior del hombro con carga.',
    confidence: 'practica',
  },
  escapulasInicio: {
    id: 'escapulas_inicio',
    metric: 'scap.prot',
    ok: [-30, -5],
    warn: [-30, 5],
    at: 'estiramiento',
    label: 'Escápulas retraídas al inicio',
    cue: 'Antes de empujar, junta las escápulas y llévalas hacia abajo.',
    why: 'Con las escápulas atrás y abajo el hombro tiene una base estable para empujar.',
    confidence: 'consenso',
    sources: ['nsca'],
  },
  escapulasFinal: {
    id: 'escapulas_final',
    metric: 'scap.prot',
    ok: [-25, 10],
    warn: [-30, 20],
    at: 'contraccion',
    label: 'Hombros sin adelantarse al final',
    cue: 'Al extender los brazos, los hombros se quedan pegados al respaldo.',
    why: 'Adelantar los hombros al final (protracción) pierde la posición estable del hombro.',
    confidence: 'consenso',
  },
  lumbar: {
    id: 'lumbar',
    metric: 'lumbar.flex',
    ok: [-18, 5],
    warn: [-28, 10],
    at: 'siempre',
    label: 'Arco lumbar moderado',
    cue: 'Pecho alto con un arco lumbar natural; glúteos y espalda apoyados.',
    why: 'Despegar la zona lumbar carga la columna y cambia el ángulo del empuje.',
    confidence: 'practica',
  },
} satisfies Record<string, JointWindow>;

/** Elevación del brazo al empezar: delata el asiento bajo (depende del agarre, que cambia la posición del codo). */
const alturaManos = (ok: readonly [number, number], warn: readonly [number, number]): JointWindow => ({
  id: 'altura_manos',
  metric: 'shoulder.elev',
  ok,
  warn,
  at: 'estiramiento',
  label: 'Manos a la altura del pecho alto',
  cue: 'Regula el asiento para que, al empezar, los manerales queden a la altura del pecho alto y no por encima de los hombros.',
  why: 'Con el asiento bajo el brazo empieza muy elevado: el ejercicio se convierte en un press de hombro.',
  confidence: 'practica',
});

const COMUNES: readonly JointWindow[] = [
  W.codosTronco,
  W.escapulasInicio,
  W.escapulasFinal,
  SHARED_WINDOWS.hombrosAbajo(),
  W.lumbar,
  SHARED_WINDOWS.muneca(),
  SHARED_WINDOWS.codoArriba(),
];

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'codos_90',
    label: 'Codos a 90°',
    description: 'Brazos en «T»: los codos se abren a la altura de los hombros.',
    consequence: 'Estrés anterior del hombro sin más trabajo de pectoral.',
    expect: ['shoulder.abd'],
  },
  {
    id: 'hombros_adelantados',
    label: 'Hombros adelantados',
    description: 'Al final del empuje los hombros se separan del respaldo (protracción).',
    consequence: 'Se pierde la posición estable del hombro y trabaja de más el pectoral menor.',
    expect: ['scap.prot'],
  },
  {
    id: 'arco_lumbar',
    label: 'Arco lumbar excesivo',
    description: 'Despegar la zona lumbar del respaldo para empujar más.',
    consequence: 'Carga lumbar y el empuje se vuelve más horizontal (menos porción clavicular).',
    expect: ['lumbar.flex'],
  },
  {
    id: 'asiento_bajo',
    label: 'Asiento demasiado bajo',
    description: 'Con el asiento bajo los manerales quedan por encima de los hombros.',
    consequence: 'El press se convierte en un press de hombro y los codos tienden a abrirse.',
    expect: ['shoulder.elev'],
  },
];

const TEMPO = { excentrica: 2, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 };
const ERROR_IDS = ERRORS.map((e) => e.id);

const CUES = {
  preparacion: [
    'Ajusta el asiento: los manerales a la altura del pecho alto.',
    'Escápulas juntas y abajo, pecho alto, pies firmes.',
    'Espalda y cabeza apoyadas en el respaldo.',
  ],
  concentrica: [
    'Empuja hacia arriba y adelante siguiendo la convergencia de la máquina.',
    'Los hombros no se despegan del respaldo. Espira al empujar.',
  ],
  pausa_contraccion: ['Codos casi extendidos, sin bloquear.'],
  excentrica: ['Vuelve en 2 s hasta que las manos queden a la altura del pecho.', 'Codos solo un poco por detrás del tronco. Inspira.'],
  pausa_estiramiento: ['Sin rebote: estiramiento controlado del pecho.'],
} as const;

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'prono',
    name: 'Agarre prono',
    short: 'Prono',
    description: 'Palmas hacia delante, codos abiertos 40–65°: más porción clavicular del pectoral y deltoides anterior.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'pectoral_clavicular', role: 'principal', level: 3 },
      { muscle: 'pectoral_esternal', role: 'sinergista', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 3 },
      { muscle: 'triceps', role: 'sinergista', level: 2 },
      { muscle: 'serrato', role: 'estabilizador', level: 1 },
      { muscle: 'trapecio_medio', role: 'estabilizador', level: 1 },
    ],
    cues: CUES,
    windows: [aperturaCodos([40, 65], [30, 78], 'Codos abiertos 40–65° respecto al tronco, por debajo de la línea de los hombros.'), alturaManos([30, 58], [22, 70]), ...COMUNES],
    errors: ERROR_IDS,
  },
  {
    id: 'neutro',
    name: 'Agarre neutro',
    short: 'Neutro',
    description: 'Palmas enfrentadas y codos más cerca del tronco (25–45°): más tríceps y más cómodo para el hombro.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'pectoral_clavicular', role: 'principal', level: 2 },
      { muscle: 'pectoral_esternal', role: 'sinergista', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 2 },
      { muscle: 'triceps', role: 'sinergista', level: 3 },
      { muscle: 'serrato', role: 'estabilizador', level: 1 },
      { muscle: 'trapecio_medio', role: 'estabilizador', level: 1 },
    ],
    cues: {
      ...CUES,
      concentrica: ['Empuja con los codos cerca del tronco, hacia arriba y adelante.', 'Los hombros no se despegan del respaldo. Espira al empujar.'],
    },
    windows: [aperturaCodos([25, 45], [15, 58], 'Codos cerca del tronco (25–45°).'), alturaManos([20, 44], [14, 56]), ...COMUNES],
    errors: ERROR_IDS,
  },
];

export const inclinadoContent: StationContent = {
  id: 'press_inclinado',
  name: 'Press inclinado de pecho (máquina)',
  short: 'Press inclinado',
  zone: 'empuje',
  family: 'pivote',
  summary: 'Empuje inclinado en máquina convergente: porción clavicular del pectoral y deltoides anterior, con las escápulas fijas.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['shoulder.abd', 'elbow.flex', 'scap.prot', 'shoulder.behind', 'lumbar.flex'],
  views: [
    { id: 'iso', label: 'Isométrica', azimuth: -40, elevation: 30 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
    { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: 20 },
    { id: 'superior', label: 'Superior', azimuth: -90, elevation: 89 },
  ],
  sources: [
    NSCA_SOURCE,
    {
      id: 'trebs2010',
      cite: 'Trebs AA, Brandenburg JP, Pitney WA (2010). An electromyography analysis of 3 muscles surrounding the shoulder joint during the performance of a chest press exercise at several angles. J Strength Cond Res 24(7):1925–1930.',
    },
    {
      id: 'rodriguez2020',
      cite: 'Rodríguez-Ridao D. et al. (2020). Effect of five bench inclinations on the electromyographic activity of the pectoralis major, anterior deltoid, and triceps brachii during the bench press exercise. Int J Environ Res Public Health 17(19):7339.',
    },
  ],
  generalCues: [
    'El empuje sale 60° sobre la horizontal, como en un banco inclinado a 30°: la inclinación donde la literatura sitúa el mayor énfasis en la porción clavicular sin que domine el deltoides.',
    'La máquina converge: deja que las manos se acerquen al final en lugar de empujar en línea recta.',
  ],
};
