import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE } from '../common';

const W = {
  colgadoActivo: {
    id: 'colgado_activo',
    metric: 'scap.elev',
    ok: [-2, 15],
    warn: [-5, 22],
    at: 'estiramiento',
    label: 'Colgado activo',
    cue: 'Abajo, brazos extendidos pero hombros «enganchados»: sin dejarte caer hasta las orejas.',
    why: 'Colgar con las escápulas sueltas deja el peso en los ligamentos del hombro y retrasa la entrada del dorsal.',
    confidence: 'practica',
  },
  escapulasAbajo: {
    id: 'escapulas_abajo',
    metric: 'scap.elev',
    ok: [-15, 3],
    warn: [-15, 10],
    at: 'contraccion',
    label: 'Hombros abajo al subir',
    cue: 'Empieza bajando las escápulas y llega arriba con los hombros lejos de las orejas.',
    why: 'Subir con los hombros encogidos pone a trabajar al trapecio superior en lugar del dorsal.',
    confidence: 'consenso',
    sources: ['nsca'],
  },
  extensionAbajo: {
    id: 'extension_abajo',
    metric: 'elbow.flex',
    ok: [3, 25],
    warn: [0, 35],
    at: 'estiramiento',
    label: 'Extensión completa abajo',
    cue: 'Baja hasta extender casi del todo los codos, sin rebotar.',
    why: 'Recorrido completo: el dorsal trabaja también en estiramiento.',
    confidence: 'practica',
  },
  cuello: {
    id: 'cuello',
    metric: 'neck.flex',
    ok: [-15, 12],
    warn: [-25, 20],
    at: 'siempre',
    label: 'Cuello neutro',
    cue: 'Lleva el pecho a la barra; no estires el cuello para «pasar» la barbilla.',
    why: 'Hiperextender el cuello para llegar a la barra carga la columna cervical.',
    confidence: 'consenso',
  },
  balanceo: {
    id: 'balanceo',
    metric: 'trunk.incline',
    ok: [-25, 5],
    warn: [-35, 12],
    at: 'movimiento',
    label: 'Sin balanceo del tronco',
    cue: 'Cuerpo firme, como una tabla; el tronco solo se inclina un poco atrás al subir.',
    why: 'El balanceo convierte el ejercicio en un impulso: menos dorsal y tirones en el hombro.',
    confidence: 'practica',
  },
  kipping: {
    id: 'cadera',
    metric: 'hip.flex',
    ok: [-5, 30],
    warn: [-10, 50],
    at: 'movimiento',
    label: 'Sin impulso de cadera',
    cue: 'Piernas quietas y juntas, abdomen firme.',
    why: 'El «kipping» usa el impulso de la cadera: menos trabajo del dorsal y carga brusca en el hombro.',
    confidence: 'practica',
  },
  lumbar: {
    id: 'lumbar',
    metric: 'lumbar.flex',
    ok: [-12, 10],
    warn: [-20, 18],
    at: 'siempre',
    label: 'Zona lumbar estable',
    cue: 'Abdomen firme: ni arquees la zona lumbar ni dobles el tronco.',
    why: 'Arquearse para subir carga la zona lumbar en extensión.',
    confidence: 'consenso',
  },
} satisfies Record<string, JointWindow>;

const barbilla = (ok: readonly [number, number], warn: readonly [number, number]): JointWindow => ({
  id: 'barbilla',
  metric: 'elbow.flex',
  ok,
  warn,
  at: 'contraccion',
  label: 'Barbilla por encima de la barra',
  cue: 'Sube hasta que la barbilla pase la barra con el pecho cerca de ella.',
  why: 'Recorrido completo arriba: la contracción máxima del dorsal y los flexores del codo.',
  confidence: 'practica',
});

const COMUNES: readonly JointWindow[] = [W.colgadoActivo, W.escapulasAbajo, W.extensionAbajo, W.balanceo, W.kipping, W.lumbar, W.cuello];

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'kipping',
    label: 'Kipping / impulso',
    description: 'Balanceo de piernas y cadera para subir.',
    consequence: 'Menos trabajo del dorsal y carga brusca en el hombro.',
    expect: ['hip.flex', 'trunk.incline'],
  },
  {
    id: 'rango_parcial',
    label: 'Recorrido parcial',
    description: 'No se extienden los codos abajo ni pasa la barbilla arriba.',
    consequence: 'Menos estímulo en los extremos del recorrido.',
    expect: ['elbow.flex'],
  },
  {
    id: 'encogimiento',
    label: 'Hombros encogidos',
    description: 'Colgado pasivo abajo y tirón con los hombros hacia las orejas.',
    consequence: 'Trapecio superior dominante y hombro en peor posición.',
    expect: ['scap.elev'],
  },
  {
    id: 'cuello',
    label: 'Estirar el cuello',
    description: 'Se hiperextiende el cuello para «llegar» con la barbilla.',
    consequence: 'Carga cervical.',
    expect: ['neck.flex'],
  },
];

const TEMPO = { excentrica: 3, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 };
const ERROR_IDS = ERRORS.map((e) => e.id);

const cues = (concentrica: string, excentrica: string) => ({
  preparacion: ['Cuelga con los brazos extendidos y los hombros activos (sin dejarte caer).', 'Abdomen firme, piernas juntas y rodillas algo flexionadas.'],
  concentrica: ['Empieza bajando las escápulas.', concentrica, 'Pecho hacia la barra, barbilla por encima sin estirar el cuello. Espira.'],
  pausa_contraccion: ['1 s arriba con los hombros lejos de las orejas.'],
  excentrica: [excentrica, 'Inspira al bajar.'],
  pausa_estiramiento: ['Colgado activo, sin balanceo.'],
});

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'prona-ancha',
    name: 'Prona ancha (pull-up)',
    short: 'Prona ancha',
    description: 'Palmas al frente y manos a ~1,5× la anchura de los hombros: los codos bajan hacia los costados.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'dorsal_ancho', role: 'principal', level: 3 },
      { muscle: 'redondo_mayor', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_inferior', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_medio', role: 'sinergista', level: 2 },
      { muscle: 'biceps', role: 'sinergista', level: 2 },
      { muscle: 'braquial', role: 'sinergista', level: 2 },
      { muscle: 'antebrazo', role: 'estabilizador', level: 3 },
      { muscle: 'abdominales', role: 'estabilizador', level: 2 },
    ],
    cues: cues('Lleva los codos hacia abajo y a los costados.', 'Baja en 2–3 s hasta extender los codos, con los codos abriéndose a los lados.'),
    windows: [barbilla([122, 152], [105, 160]), ...COMUNES],
    errors: ERROR_IDS,
  },
  {
    id: 'supina',
    name: 'Supina (chin-up)',
    short: 'Supina',
    description: 'Palmas hacia ti y manos a la anchura de los hombros: los codos bajan por delante. Más bíceps.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'dorsal_ancho', role: 'principal', level: 3 },
      { muscle: 'biceps', role: 'principal', level: 3 },
      { muscle: 'braquial', role: 'sinergista', level: 2 },
      { muscle: 'redondo_mayor', role: 'sinergista', level: 2 },
      { muscle: 'pectoral_esternal', role: 'sinergista', level: 1 },
      { muscle: 'trapecio_inferior', role: 'sinergista', level: 1 },
      { muscle: 'antebrazo', role: 'estabilizador', level: 2 },
      { muscle: 'abdominales', role: 'estabilizador', level: 2 },
    ],
    cues: cues('Lleva los codos hacia abajo y hacia las costillas, por delante del cuerpo.', 'Baja en 2–3 s hasta extender los codos.'),
    windows: [barbilla([130, 160], [115, 165]), ...COMUNES],
    errors: ERROR_IDS,
  },
  {
    id: 'neutra',
    name: 'Neutra (asas paralelas)',
    short: 'Neutra',
    description: 'Palmas enfrentadas en las asas paralelas y codos pegados: más braquial y braquiorradial.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'dorsal_ancho', role: 'principal', level: 3 },
      { muscle: 'braquial', role: 'sinergista', level: 3 },
      { muscle: 'biceps', role: 'sinergista', level: 2 },
      { muscle: 'redondo_mayor', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_medio', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_inferior', role: 'sinergista', level: 1 },
      { muscle: 'antebrazo', role: 'estabilizador', level: 2 },
      { muscle: 'abdominales', role: 'estabilizador', level: 2 },
    ],
    cues: cues('Lleva los codos pegados hacia las costillas.', 'Baja en 2–3 s hasta extender los codos.'),
    windows: [barbilla([128, 160], [112, 165]), ...COMUNES],
    errors: ERROR_IDS,
  },
];

export const dominadasContent: StationContent = {
  id: 'dominadas',
  name: 'Barra de dominadas',
  short: 'Dominadas',
  zone: 'traccion',
  family: 'corporal',
  summary: 'Tracción vertical con el propio cuerpo: dorsal ancho como motor principal; el agarre reparte el trabajo entre el dorsal, el bíceps y el braquial.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['elbow.flex', 'shoulder.elev', 'scap.elev', 'trunk.incline', 'hip.flex'],
  views: [
    { id: 'posterior', label: 'Posterior', azimuth: 155, elevation: 20 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
    { id: 'iso', label: 'Isométrica', azimuth: -45, elevation: 30 },
    { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: 10 },
  ],
  sources: [
    NSCA_SOURCE,
    {
      id: 'youdas2010',
      cite: 'Youdas JW et al. (2010). Surface electromyographic activation patterns and elbow joint motion during a pull-up, chin-up, or perfect-pullup rotational exercise. J Strength Cond Res 24(12):3404–3414.',
    },
    { id: 'dickie2017', cite: 'Dickie JA et al. (2017). Electromyographic analysis of muscle activation during pull-up variations. J Electromyogr Kinesiol 32:30–36.' },
  ],
  generalCues: [
    'El agarre decide el reparto: prono ancho, más dorsal y trapecio inferior; supino, más bíceps; neutro, más braquial (Youdas et al., 2010; Dickie et al., 2017).',
    'Si no llegas a 5 repeticiones completas, usa la rodillera de asistencia; si haces más de 10, añade lastre.',
  ],
};
