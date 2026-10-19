import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE, SHARED_WINDOWS } from '../common';

const codos = (ok: readonly [number, number], warn: readonly [number, number], cue: string): JointWindow => ({
  id: 'codos',
  metric: 'shoulder.abd',
  ok,
  warn,
  at: 'estiramiento',
  label: 'Ángulo de los codos respecto al tronco',
  cue,
  why: 'Con los codos a 90° («en T») aumenta el estrés subacromial y anterior del hombro; demasiado pegados, el empuje pasa al tríceps.',
  confidence: 'consenso',
  sources: ['green2007', 'nsca'],
});

const W = {
  retraidas: {
    id: 'escapulas_retraidas',
    metric: 'scap.prot',
    ok: [-30, -8],
    warn: [-30, 0],
    at: 'siempre',
    label: 'Escápulas retraídas',
    cue: 'Escápulas juntas y apoyadas en el banco durante toda la serie.',
    why: 'Las escápulas retraídas dan una base estable y alejan el hombro de posiciones de riesgo.',
    confidence: 'consenso',
    sources: ['nsca'],
  },
  deprimidas: {
    id: 'escapulas_deprimidas',
    metric: 'scap.elev',
    ok: [-15, 3],
    warn: [-15, 10],
    at: 'siempre',
    label: 'Escápulas deprimidas',
    cue: 'Hombros hacia los bolsillos traseros, lejos de las orejas.',
    why: 'Encoger los hombros resta estabilidad y desplaza la carga al trapecio superior.',
    confidence: 'consenso',
  },
  profundidad: {
    id: 'profundidad',
    metric: 'elbow.flex',
    ok: [100, 142],
    warn: [88, 152],
    at: 'estiramiento',
    label: 'Profundidad: barra al pecho',
    cue: 'Baja hasta tocar suavemente el esternón bajo, con los antebrazos verticales.',
    why: 'Recorrido completo sin rebote: el pectoral trabaja en estiramiento sin que el pecho «lance» la barra.',
    confidence: 'practica',
  },
  arco: {
    id: 'arco',
    metric: 'lumbar.flex',
    ok: [-25, 0],
    warn: [-35, 5],
    at: 'siempre',
    label: 'Arco lumbar moderado',
    cue: 'Arco natural con los glúteos en el banco.',
    why: 'Un arco extremo (o despegar los glúteos) carga la zona lumbar en extensión.',
    confidence: 'practica',
  },
  gluteos: {
    id: 'gluteos',
    metric: 'hip.flex',
    ok: [-8, 45],
    warn: [-14, 55],
    at: 'siempre',
    label: 'Glúteos en el banco',
    cue: 'Empuja con las piernas hacia el suelo sin levantar los glúteos.',
    why: 'Hacer un puente con la cadera hiperextiende la zona lumbar y cambia el ángulo del press.',
    confidence: 'practica',
  },
} satisfies Record<string, JointWindow>;

const COMUNES: readonly JointWindow[] = [
  W.retraidas,
  W.deprimidas,
  SHARED_WINDOWS.muneca(),
  W.profundidad,
  SHARED_WINDOWS.codoArriba(),
  W.arco,
  W.gluteos,
  SHARED_WINDOWS.cuello([-10, 10], [-20, 20]),
];

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'codos_90',
    label: 'Codos a 90°',
    description: 'Brazos en «T» respecto al tronco al bajar la barra.',
    consequence: 'Más estrés subacromial y anterior del hombro.',
    expect: ['shoulder.abd'],
  },
  {
    id: 'escapulas_sueltas',
    label: 'Escápulas sueltas',
    description: 'Los hombros se adelantan al empujar y las escápulas se despegan del banco.',
    consequence: 'Peor estabilidad del hombro y menos transferencia de fuerza.',
    expect: ['scap.prot'],
  },
  {
    id: 'munecas',
    label: 'Muñecas dobladas hacia atrás',
    description: 'La barra cae hacia los dedos y la muñeca se extiende bajo la carga.',
    consequence: 'Sobrecarga de la muñeca y fuerza mal transmitida al antebrazo.',
    expect: ['wrist.ext'],
  },
  {
    id: 'gluteos',
    label: 'Glúteos despegados',
    description: 'Puente de cadera para empujar más peso.',
    consequence: 'Hiperextensión lumbar y cambio del ángulo del press.',
    expect: ['hip.flex', 'lumbar.flex'],
  },
  {
    id: 'barra_cuello',
    label: 'Barra hacia el cuello',
    description: 'La barra baja demasiado alta, hacia las clavículas o el cuello.',
    consequence: 'Codos abiertos a 90° y hombro en posición comprometida.',
    expect: ['shoulder.abd'],
  },
];

const TEMPO = { excentrica: 3, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 0 };
const ERROR_IDS = ERRORS.map((e) => e.id);

const CUES = {
  preparacion: [
    'Ojos bajo la barra; escápulas juntas y abajo, como metiéndolas en los bolsillos traseros.',
    'Arco natural, glúteos en el banco y pies firmes en el suelo.',
    'Saca la barra con los brazos extendidos y llévala sobre los hombros.',
  ],
  excentrica: ['Baja en 2–3 s hacia el esternón bajo.', 'Antebrazos verticales: muñecas apiladas sobre los codos. Inspira.'],
  pausa_estiramiento: ['Contacto suave con el pecho, sin rebote.'],
  concentrica: ['Empuja hacia arriba y ligeramente atrás, hacia la vertical de los hombros.', 'Escápulas pegadas al banco. Espira al empujar.'],
  pausa_contraccion: ['Codos casi extendidos, sin bloquear de golpe.'],
} as const;

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'medio',
    name: 'Agarre medio',
    short: 'Agarre medio',
    description: 'Manos a ≤1,5× la anchura biacromial y codos a 45–70° del tronco: el reparto más equilibrado.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'pectoral_esternal', role: 'principal', level: 3 },
      { muscle: 'pectoral_clavicular', role: 'sinergista', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 2 },
      { muscle: 'triceps', role: 'sinergista', level: 2 },
      { muscle: 'serrato', role: 'estabilizador', level: 1 },
      { muscle: 'trapecio_medio', role: 'estabilizador', level: 1 },
      { muscle: 'antebrazo', role: 'estabilizador', level: 1 },
    ],
    cues: CUES,
    windows: [codos([45, 70], [35, 80], 'Codos a 45–70° del tronco: ni pegados ni en «T».'), ...COMUNES],
    errors: ERROR_IDS,
  },
  {
    id: 'cerrado',
    name: 'Agarre cerrado',
    short: 'Agarre cerrado',
    description: 'Manos a la anchura de los hombros y codos pegados (20–45°): más tríceps.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'triceps', role: 'principal', level: 3 },
      { muscle: 'pectoral_esternal', role: 'sinergista', level: 2 },
      { muscle: 'pectoral_clavicular', role: 'sinergista', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 2 },
      { muscle: 'serrato', role: 'estabilizador', level: 1 },
      { muscle: 'trapecio_medio', role: 'estabilizador', level: 1 },
      { muscle: 'antebrazo', role: 'estabilizador', level: 1 },
    ],
    cues: { ...CUES, excentrica: ['Baja en 2–3 s con los codos rozando los costados.', 'Antebrazos verticales. Inspira.'] },
    windows: [codos([20, 45], [10, 55], 'Codos cerca del tronco (20–45°).'), ...COMUNES],
    errors: ERROR_IDS,
  },
  {
    id: 'ancho',
    name: 'Agarre ancho',
    short: 'Agarre ancho',
    description: 'Manos a más de 1,5× la anchura biacromial: más pectoral y más estrés en el hombro.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'pectoral_esternal', role: 'principal', level: 3 },
      { muscle: 'pectoral_clavicular', role: 'sinergista', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 2 },
      { muscle: 'triceps', role: 'sinergista', level: 1 },
      { muscle: 'serrato', role: 'estabilizador', level: 1 },
      { muscle: 'trapecio_medio', role: 'estabilizador', level: 1 },
      { muscle: 'antebrazo', role: 'estabilizador', level: 1 },
    ],
    cues: CUES,
    windows: [codos([58, 80], [50, 88], 'Codos a 60–80°: vigila no llegar a 90°.'), ...COMUNES],
    errors: ERROR_IDS.filter((e) => e !== 'codos_90'),
  },
];

export const bancaContent: StationContent = {
  id: 'press_banca',
  name: 'Press de banca con barra',
  short: 'Press de banca',
  zone: 'empuje',
  family: 'libre',
  summary: 'Empuje horizontal tumbado con barra libre: pectoral mayor, deltoides anterior y tríceps, con las escápulas fijas.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['shoulder.abd', 'elbow.flex', 'wrist.ext', 'scap.prot', 'lumbar.flex'],
  views: [
    { id: 'iso', label: 'Isométrica', azimuth: 50, elevation: 35.264 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
    { id: 'pies', label: 'Desde los pies', azimuth: 0, elevation: 25 },
    { id: 'superior', label: 'Superior', azimuth: 0, elevation: 89 },
  ],
  sources: [
    NSCA_SOURCE,
    { id: 'green2007', cite: 'Green CM, Comfort P (2007). The affect of grip width on bench press performance and risk of injury. Strength Cond J 29(5):10–14.' },
    {
      id: 'lehman2005',
      cite: 'Lehman GJ (2005). The influence of grip width and forearm pronation/supination on upper-body myoelectric activity during the flat bench press. J Strength Cond Res 19(3):587–591.',
    },
    {
      id: 'saeterbakken2017',
      cite: 'Saeterbakken AH et al. (2017). The effects of bench press variations in competitive athletes on muscle activity and performance. J Hum Kinet 57:61–71.',
    },
  ],
  generalCues: [
    'Usa siempre brazos de seguridad o un compañero: la barra libre no tiene topes.',
    'La trayectoria en «J» es la natural: abajo, la barra toca el esternón bajo; arriba, termina sobre los hombros.',
  ],
};
