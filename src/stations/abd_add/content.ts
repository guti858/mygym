import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE, SHARED_WINDOWS } from '../common';

const W = {
  aperturaFinal: {
    id: 'apertura_final',
    metric: 'hip.abd',
    ok: [30, 50],
    warn: [20, 60],
    at: 'contraccion',
    label: 'Apertura final',
    cue: 'Abre hasta que cada muslo se separe unos 30–50° de la línea media (60–100° entre ambos), sin forzar.',
    why: 'Por debajo el recorrido se queda corto; por encima, la pelvis tiende a bascular para seguir abriendo.',
    confidence: 'practica',
  },
  aperturaInicial: {
    id: 'apertura_inicial',
    metric: 'hip.abd',
    ok: [25, 45],
    warn: [15, 55],
    at: 'estiramiento',
    label: 'Apertura inicial no excesiva',
    cue: 'Ajusta el rango inicial a una apertura cómoda, no la máxima.',
    why: 'Empezar con los aductores en estiramiento máximo y carga aumenta el riesgo de distensión.',
    confidence: 'practica',
  },
  pelvis: {
    id: 'pelvis',
    metric: 'pelvis.tilt',
    ok: [-6, 10],
    warn: [-12, 16],
    at: 'siempre',
    label: 'Pelvis estable',
    cue: 'Pelvis quieta y apoyada: el movimiento sale solo de la cadera.',
    why: 'Bascular la pelvis para mover más peso carga la zona lumbar y resta trabajo a la cadera.',
    confidence: 'consenso',
  },
  lumbar: {
    id: 'lumbar',
    metric: 'lumbar.flex',
    ok: [-10, 8],
    warn: [-16, 14],
    at: 'siempre',
    label: 'Zona lumbar neutra',
    cue: 'Zona lumbar apoyada y neutra, abdomen firme.',
    why: 'Redondear la zona lumbar acompaña a la pelvis que bascula.',
    confidence: 'consenso',
  },
  rodillas: {
    id: 'rodillas',
    metric: 'knee.flex',
    ok: [70, 110],
    warn: [60, 120],
    at: 'siempre',
    label: 'Rodillas a unos 90°',
    cue: 'Pies en los reposapiés y rodillas a unos 90°.',
    why: 'Con las rodillas a 90° las almohadillas apoyan sobre el muslo y no sobre la articulación.',
    confidence: 'practica',
  },
} satisfies Record<string, JointWindow>;

const tronco = (ok: readonly [number, number], warn: readonly [number, number], cue: string): JointWindow => ({
  id: 'tronco',
  metric: 'trunk.incline',
  ok,
  warn,
  at: 'siempre',
  label: 'Tronco quieto',
  cue,
  why: 'Mover el tronco añade inercia y quita control al movimiento de la cadera.',
  confidence: 'practica',
});

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'rango_inicial',
    label: 'Rango inicial excesivo',
    description: 'El pasador deja las piernas muy abiertas al empezar la aducción.',
    consequence: 'Aductores en estiramiento máximo con carga: riesgo de distensión.',
    expect: ['hip.abd'],
  },
  {
    id: 'pelvis',
    label: 'Pelvis que bascula',
    description: 'La pelvis se despega y bascula hacia atrás para mover más peso.',
    consequence: 'Carga lumbar y menos trabajo de la cadera.',
    expect: ['pelvis.tilt', 'lumbar.flex'],
  },
  {
    id: 'balanceo',
    label: 'Tronco que se balancea',
    description: 'El tronco se mueve para ayudar a abrir o cerrar.',
    consequence: 'Inercia y pérdida de control.',
    expect: ['trunk.incline'],
  },
];

const TEMPO = { excentrica: 2, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 };

const preparacion = (extra: string) => ['Caderas al fondo del asiento, pies en los reposapiés y manos en los agarres.', extra];

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'abduccion',
    name: 'Abducción',
    short: 'Abducción',
    description: 'Almohadillas por fuera de las rodillas y espalda apoyada: glúteo medio y menor.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'gluteo_medio', role: 'principal', level: 3 },
      { muscle: 'gluteo_mayor', role: 'sinergista', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      preparacion: preparacion('Espalda y pelvis apoyadas en el respaldo, piernas casi juntas.'),
      concentrica: ['Abre las piernas empujando con la parte externa de las rodillas.', 'Sin despegar la pelvis. Espira.'],
      pausa_contraccion: ['1 s con las piernas abiertas.'],
      excentrica: ['Cierra en 2 s sin que las placas choquen. Inspira.'],
      pausa_estiramiento: ['Sin rebote.'],
    },
    windows: [W.aperturaFinal, W.pelvis, W.lumbar, tronco([-25, 0], [-35, 10], 'Espalda apoyada en el respaldo.'), W.rodillas, SHARED_WINDOWS.cuello()],
    errors: ['pelvis', 'balanceo'],
  },
  {
    id: 'abduccion-inclinada',
    name: 'Abducción con tronco inclinado',
    short: 'Abducción inclinada',
    description: 'Tronco unos 30° adelante y sin apoyo: participa más la porción superior del glúteo mayor.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'gluteo_medio', role: 'principal', level: 3 },
      { muscle: 'gluteo_mayor', role: 'sinergista', level: 2 },
      { muscle: 'erectores', role: 'estabilizador', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      preparacion: preparacion('Inclina el tronco unos 30° hacia delante con la espalda recta.'),
      concentrica: ['Abre las piernas manteniendo la inclinación del tronco.', 'Espira.'],
      pausa_contraccion: ['1 s con las piernas abiertas.'],
      excentrica: ['Cierra en 2 s, sin levantar el tronco. Inspira.'],
      pausa_estiramiento: ['Sin rebote.'],
    },
    windows: [W.aperturaFinal, W.pelvis, W.lumbar, tronco([20, 40], [10, 50], 'Tronco inclinado unos 30° y quieto.'), W.rodillas, SHARED_WINDOWS.cuello()],
    errors: ['pelvis', 'balanceo'],
  },
  {
    id: 'aduccion',
    name: 'Aducción',
    short: 'Aducción',
    description: 'Almohadillas por dentro de las rodillas: aductores; la apertura inicial se regula con el pasador.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'aductores', role: 'principal', level: 3 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      preparacion: preparacion('Ajusta el rango inicial a una apertura cómoda, no la máxima.'),
      concentrica: ['Cierra las piernas apretando con la parte interna de los muslos.', 'Sin despegar la pelvis. Espira.'],
      pausa_contraccion: ['1 s con las piernas juntas.'],
      excentrica: ['Abre en 2 s hasta la apertura inicial, sin rebote. Inspira.'],
      pausa_estiramiento: ['Estiramiento cómodo, sin forzar.'],
    },
    windows: [W.aperturaInicial, W.pelvis, W.lumbar, tronco([-25, 0], [-35, 10], 'Espalda apoyada en el respaldo.'), W.rodillas, SHARED_WINDOWS.cuello()],
    errors: ['rango_inicial', 'pelvis', 'balanceo'],
  },
];

export const abdAddContent: StationContent = {
  id: 'abd_add',
  name: 'Abductores / aductores',
  short: 'Abd. / aduct.',
  zone: 'pierna',
  family: 'pivote',
  summary: 'Sentado, los muslos se abren o se cierran en el plano horizontal: glúteo medio en la abducción y aductores en la aducción.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['hip.abd', 'pelvis.tilt', 'lumbar.flex', 'trunk.incline', 'knee.flex'],
  views: [
    { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: 30 },
    { id: 'superior', label: 'Superior', azimuth: 0, elevation: 89 },
    { id: 'iso', label: 'Isométrica', azimuth: -40, elevation: 35.264 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
  ],
  sources: [
    NSCA_SOURCE,
    {
      id: 'reiman2012',
      cite: 'Reiman MP, Bolgla LA, Loudon JK (2012). A literature review of studies evaluating gluteus maximus and gluteus medius activation during rehabilitation exercises. Physiother Theory Pract 28(4):257–268.',
    },
  ],
  generalCues: [
    'La literatura específica de esta máquina es escasa: varias ventanas son práctica habitual, no evidencia.',
    'La vista frontal o superior muestra mejor la apertura de los muslos.',
  ],
};
