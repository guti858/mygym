import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE, SHARED_WINDOWS } from '../common';

const W = {
  codosPlano: {
    id: 'codos_plano',
    metric: 'shoulder.behind',
    ok: [-50, 0],
    warn: [-62, 10],
    at: 'estiramiento',
    label: 'Codos en el plano escapular',
    cue: 'Abajo, codos ligeramente por delante del cuerpo (unos 30°), nunca por detrás de la línea de los hombros.',
    why: 'Con el brazo elevado y el codo por detrás del tronco, el hombro trabaja en abducción horizontal y rotación externa extremas: más estrés en su parte anterior.',
    confidence: 'consenso',
    sources: ['ludewig2009', 'nsca'],
  },
  lumbar: {
    id: 'lumbar',
    metric: 'lumbar.flex',
    ok: [-15, 5],
    warn: [-25, 10],
    at: 'siempre',
    label: 'Zona lumbar apoyada',
    cue: 'Abdomen firme y la zona lumbar en contacto con el respaldo; no arquees para empujar más.',
    why: 'Arquear la zona lumbar desplaza la carga a la columna en extensión y convierte el press en un press inclinado.',
    confidence: 'consenso',
    sources: ['mcgill'],
  },
  tronco: {
    id: 'tronco',
    metric: 'trunk.incline',
    ok: [-15, 5],
    warn: [-22, 10],
    at: 'siempre',
    label: 'Tronco contra el respaldo',
    cue: 'Espalda alta y cabeza apoyadas; el tronco no se echa hacia atrás al empujar.',
    why: 'Recostarse cambia el ángulo del empuje y suele ir con hiperextensión lumbar.',
    confidence: 'practica',
  },
  encogimiento: {
    id: 'encogimiento',
    metric: 'scap.elev',
    ok: [-5, 15],
    warn: [-10, 22],
    at: 'contraccion',
    label: 'Encogimiento contenido arriba',
    cue: 'Deja que las escápulas suban y roten con naturalidad, sin llevar los hombros a las orejas.',
    why: 'Algo de elevación escapular es parte del ritmo normal del hombro; encoger de más da protagonismo al trapecio superior.',
    confidence: 'practica',
    sources: ['inman1944'],
  },
  profundidad: {
    id: 'profundidad',
    metric: 'elbow.flex',
    ok: [108, 138],
    warn: [95, 150],
    at: 'estiramiento',
    label: 'Profundidad: manos a la barbilla',
    cue: 'Baja hasta que las manos queden a la altura de la barbilla, con los antebrazos casi verticales.',
    why: 'Quedarse a la altura de la frente recorta el rango en el que más trabaja el deltoides.',
    confidence: 'practica',
  },
} satisfies Record<string, JointWindow>;

const WINDOWS: readonly JointWindow[] = [
  W.codosPlano,
  W.lumbar,
  W.tronco,
  W.encogimiento,
  W.profundidad,
  SHARED_WINDOWS.codoArriba(),
  SHARED_WINDOWS.cuello([-10, 10], [-20, 20]),
  SHARED_WINDOWS.muneca(),
];

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'arco_lumbar',
    label: 'Arco lumbar',
    description: 'Despegar la zona lumbar del respaldo y echar el tronco atrás para empujar más.',
    consequence: 'Carga lumbar en extensión y el press se convierte en un press inclinado.',
    expect: ['lumbar.flex', 'trunk.incline'],
  },
  {
    id: 'codos_atras',
    label: 'Codos por detrás del cuerpo',
    description: 'Abajo, los codos se van por detrás de la línea de los hombros.',
    consequence: 'Abducción horizontal con el brazo elevado: estrés anterior del hombro.',
    expect: ['shoulder.behind'],
  },
  {
    id: 'encogimiento',
    label: 'Encogimiento exagerado',
    description: 'Los hombros suben hacia las orejas al extender los brazos.',
    consequence: 'Trapecio superior dominante y peor posición del hombro.',
    expect: ['scap.elev'],
  },
  {
    id: 'rango_parcial',
    label: 'Recorrido parcial',
    description: 'Bajar solo hasta la altura de la frente.',
    consequence: 'Se pierde la parte baja del recorrido, la de mayor estiramiento del deltoides.',
    expect: ['elbow.flex'],
  },
];

const TEMPO = { excentrica: 2, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 };
const ERROR_IDS = ERRORS.map((e) => e.id);

const CUES = {
  preparacion: [
    'Ajusta el asiento: al empezar, los manerales a la altura de la barbilla.',
    'Espalda y cabeza apoyadas, abdomen firme, pies planos.',
    'Codos por debajo de las muñecas.',
  ],
  concentrica: [
    'Empuja hacia arriba sin arquear la zona lumbar.',
    'Deja que las escápulas roten hacia arriba con naturalidad. Espira al empujar.',
  ],
  pausa_contraccion: ['Brazos casi extendidos, sin bloquear; hombros lejos de las orejas.'],
  excentrica: ['Baja en 2 s hasta que las manos lleguen a la barbilla.', 'Codos ligeramente por delante del cuerpo. Inspira.'],
  pausa_estiramiento: ['Sin rebote: mantén el control abajo.'],
} as const;

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'prono',
    name: 'Agarre prono',
    short: 'Prono',
    description: 'Palmas al frente, manos algo más anchas que los hombros. Codos en el plano escapular (~30° por delante).',
    tempo: TEMPO,
    muscles: [
      { muscle: 'deltoides_anterior', role: 'principal', level: 3 },
      { muscle: 'deltoides_lateral', role: 'principal', level: 2 },
      { muscle: 'triceps', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_superior', role: 'sinergista', level: 2 },
      { muscle: 'serrato', role: 'sinergista', level: 2 },
      { muscle: 'pectoral_clavicular', role: 'sinergista', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: CUES,
    windows: WINDOWS,
    errors: ERROR_IDS,
  },
  {
    id: 'neutro',
    name: 'Agarre neutro',
    short: 'Neutro',
    description: 'Palmas enfrentadas y codos más adelantados: más cómodo para hombros sensibles.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'deltoides_anterior', role: 'principal', level: 3 },
      { muscle: 'deltoides_lateral', role: 'sinergista', level: 1 },
      { muscle: 'triceps', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_superior', role: 'sinergista', level: 2 },
      { muscle: 'serrato', role: 'sinergista', level: 2 },
      { muscle: 'pectoral_clavicular', role: 'sinergista', level: 2 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      ...CUES,
      concentrica: ['Empuja hacia arriba con los codos por delante del cuerpo.', 'Sin arquear la zona lumbar. Espira al empujar.'],
    },
    windows: WINDOWS,
    errors: ERROR_IDS,
  },
];

export const militarContent: StationContent = {
  id: 'press_militar',
  name: 'Press militar (máquina)',
  short: 'Press militar',
  zone: 'empuje',
  family: 'pivote',
  summary: 'Empuje vertical sentado: deltoides anterior y lateral como motores, con la zona lumbar apoyada.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['elbow.flex', 'shoulder.behind', 'scap.elev', 'trunk.incline', 'lumbar.flex'],
  views: [
    { id: 'iso', label: 'Isométrica', azimuth: -40, elevation: 30 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
    { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: 8 },
    { id: 'superior', label: 'Superior', azimuth: -90, elevation: 89 },
  ],
  sources: [
    NSCA_SOURCE,
    {
      id: 'saeterbakken2013',
      cite: 'Saeterbakken AH, Fimland MS (2013). Effects of body position and loading modality on muscle activity and strength in shoulder presses. J Strength Cond Res 27(7):1824–1831.',
    },
    {
      id: 'ludewig2009',
      cite: 'Ludewig PM, Reynolds JF (2009). The association of scapular kinematics and glenohumeral joint pathologies. J Orthop Sports Phys Ther 39(2):90–104.',
    },
    { id: 'inman1944', cite: 'Inman VT, Saunders JB, Abbott LC (1944). Observations on the function of the shoulder joint. J Bone Joint Surg 26:1–30 (ritmo escapulohumeral).' },
    { id: 'mcgill', cite: 'McGill S. Low Back Disorders, 3.ª ed., Human Kinetics, 2016.' },
  ],
  generalCues: [
    'Sentado y con respaldo, el press de hombro permite más carga y estabilidad que de pie; la activación del deltoides es similar (Saeterbakken y Fimland, 2013).',
    'La profundidad se mide por el codo: abajo, antebrazos casi verticales y manos a la altura de la barbilla.',
  ],
};
