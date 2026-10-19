import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';

const W = {
  rodilla: {
    id: 'rodilla',
    metric: 'knee.flex',
    ok: [5, 112],
    warn: [2, 125],
    at: 'siempre',
    label: 'Rodilla · rango de trabajo',
    cue: 'Arriba, extiende sin bloquear (deja ≥5° de flexión). Abajo, baja hasta ~90° mientras la pelvis siga apoyada.',
    why: 'Bloquear la rodilla con carga la deja sin protección muscular; bajar más allá de lo que permite la cadera despega la pelvis.',
    confidence: 'consenso',
    sources: ['escamilla2001', 'nsca'],
  },
  valgo: {
    id: 'valgo',
    metric: 'knee.valgus',
    ok: [-10, 8],
    warn: [-15, 15],
    at: 'siempre',
    label: 'Rodillas alineadas con los pies',
    cue: 'Empuja con las rodillas en la dirección de las puntas de los pies (sobre el 2.º–3.er dedo).',
    why: 'El colapso medial (valgo dinámico) aumenta el estrés en ligamentos y articulación femoropatelar.',
    confidence: 'consenso',
    sources: ['hewett2005', 'nsca'],
  },
  pelvis: {
    id: 'pelvis',
    metric: 'pelvis.tilt',
    ok: [-4, 10],
    warn: [-10, 15],
    at: 'siempre',
    label: 'Pelvis apoyada (sin retroversión)',
    cue: 'Glúteos y sacro pegados al asiento: si la pelvis empieza a enrollarse, has llegado a tu profundidad.',
    why: 'La retroversión pélvica bajo carga flexiona la columna lumbar (el «butt wink» de la prensa).',
    confidence: 'consenso',
    sources: ['mcgill', 'nsca'],
  },
  lumbar: {
    id: 'lumbar',
    metric: 'lumbar.flex',
    ok: [-10, 6],
    warn: [-15, 14],
    at: 'siempre',
    label: 'Columna lumbar neutra',
    cue: 'Mantén la curva lumbar natural contra el respaldo durante todo el recorrido.',
    why: 'La flexión lumbar repetida con carga axial es un mecanismo conocido de lesión discal.',
    confidence: 'evidencia',
    sources: ['mcgill'],
  },
  talon: {
    id: 'talon',
    metric: 'foot.heelLift',
    ok: [0, 1],
    warn: [0, 6],
    at: 'siempre',
    label: 'Talones apoyados',
    cue: 'Reparte la presión en todo el pie y empuja desde el talón y el medio pie.',
    why: 'Despegar el talón traslada la carga a la parte anterior de la rodilla y al antepié.',
    confidence: 'practica',
    sources: ['nsca'],
  },
} satisfies Record<string, JointWindow>;

const WINDOWS_PRENSA: readonly JointWindow[] = [W.rodilla, W.valgo, W.pelvis, W.lumbar, W.talon];

const W_GEMELO = {
  rodilla: {
    id: 'rodilla_gemelo',
    metric: 'knee.flex',
    ok: [4, 25],
    warn: [2, 35],
    at: 'siempre',
    label: 'Rodillas casi extendidas, sin bloquear',
    cue: 'Rodillas con un ligero flexo fijo: el movimiento es solo del tobillo.',
    why: 'Bloquear la rodilla con la plataforma cargada deja la articulación sin margen ante un resbalón.',
    confidence: 'practica',
    sources: ['nsca'],
  },
  estiramiento: {
    id: 'estiramiento_gemelo',
    metric: 'ankle.dorsi',
    ok: [8, 30],
    warn: [0, 35],
    at: 'estiramiento',
    label: 'Estiramiento completo abajo',
    cue: 'Deja que el talón baje por debajo de la plataforma hasta notar el estiramiento.',
    why: 'Sin la fase estirada el gemelo trabaja en un rango corto.',
    confidence: 'practica',
  },
  contraccion: {
    id: 'contraccion_gemelo',
    metric: 'ankle.dorsi',
    ok: [-40, -15],
    warn: [-40, -5],
    at: 'contraccion',
    label: 'Contracción completa arriba',
    cue: 'Empuja con la bola del pie hasta la máxima flexión plantar y mantén 1 s.',
    why: 'Cortar el recorrido reduce el trabajo de gemelo y sóleo.',
    confidence: 'practica',
  },
} satisfies Record<string, JointWindow>;

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'profundidad',
    label: 'Bajar demasiado (pelvis enrollada)',
    description: 'Llevar el carro más abajo de lo que permite la flexión de cadera: la pelvis retroversa y la lumbar se flexiona.',
    consequence: 'Flexión lumbar con carga: mayor estrés discal.',
    expect: ['pelvis.tilt', 'lumbar.flex'],
  },
  {
    id: 'valgo',
    label: 'Rodillas hacia dentro',
    description: 'Las rodillas se cierran al iniciar el empuje desde abajo.',
    consequence: 'Estrés en ligamentos y articulación femoropatelar.',
    expect: ['knee.valgus'],
  },
  {
    id: 'bloqueo',
    label: 'Bloquear las rodillas',
    description: 'Extender las rodillas por completo (y de golpe) al final del empuje.',
    consequence: 'La articulación soporta la carga sin protección muscular.',
    expect: ['knee.flex'],
  },
  {
    id: 'talones',
    label: 'Talones despegados',
    description: 'El peso se va a la punta del pie en la parte baja del recorrido.',
    consequence: 'Mayor carga en la rodilla anterior y pérdida de estabilidad.',
    expect: ['foot.heelLift'],
  },
  {
    id: 'rango_parcial',
    label: 'Recorrido parcial',
    description: 'Mover el tobillo solo unos grados, sin estirar ni contraer del todo.',
    consequence: 'Menos estímulo para gemelo y sóleo.',
    expect: ['ankle.dorsi'],
  },
];

const CUES = {
  preparacion: [
    'Espalda, sacro y cabeza apoyados en el respaldo.',
    'Pies según la variante, rodillas en línea con las puntas.',
    'Quita los seguros solo cuando la posición sea estable.',
  ],
  excentrica: [
    'Baja el carro en 3 s, con las rodillas siguiendo la dirección de los pies.',
    'Inspira y mantén el abdomen firme.',
    'Para cuando la pelvis empiece a despegarse del asiento.',
  ],
  pausa_estiramiento: ['Pausa breve sin rebotar; talones y glúteos apoyados.'],
  concentrica: [
    'Empuja con todo el pie (talón y medio pie).',
    'Rodillas hacia fuera, alineadas con los pies. Espira al empujar.',
  ],
  pausa_contraccion: ['Arriba sin bloquear las rodillas.'],
} as const;

const TEMPO = { excentrica: 3, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 };
const BASE_ERRORS = ['profundidad', 'valgo', 'bloqueo', 'talones'];

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'medios',
    name: 'Pies en el centro',
    short: 'Pies medios',
    description: 'Posición estándar: reparte el trabajo entre cuádriceps y glúteo.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'cuadriceps', role: 'principal', level: 3 },
      { muscle: 'gluteo_mayor', role: 'principal', level: 2 },
      { muscle: 'aductores', role: 'sinergista', level: 2 },
      { muscle: 'isquiotibiales', role: 'sinergista', level: 1 },
      { muscle: 'soleo', role: 'estabilizador', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: CUES,
    windows: WINDOWS_PRENSA,
    errors: BASE_ERRORS,
  },
  {
    id: 'altos',
    name: 'Pies altos',
    short: 'Pies altos',
    description: 'Más flexión de cadera y menos de rodilla: más glúteo e isquios, menos cuádriceps. La pelvis llega antes a su límite.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'gluteo_mayor', role: 'principal', level: 3 },
      { muscle: 'cuadriceps', role: 'principal', level: 2 },
      { muscle: 'isquiotibiales', role: 'sinergista', level: 2 },
      { muscle: 'aductores', role: 'sinergista', level: 2 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      ...CUES,
      excentrica: [
        'Baja en 3 s: con los pies altos la cadera se flexiona antes, vigila la pelvis.',
        'Inspira y mantén el abdomen firme.',
      ],
    },
    windows: WINDOWS_PRENSA,
    errors: BASE_ERRORS,
  },
  {
    id: 'bajos',
    name: 'Pies bajos',
    short: 'Pies bajos',
    description: 'Más flexión de rodilla y de tobillo: énfasis en cuádriceps. Exige flexión dorsal; los talones tienden a despegarse.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'cuadriceps', role: 'principal', level: 3 },
      { muscle: 'gluteo_mayor', role: 'sinergista', level: 1 },
      { muscle: 'aductores', role: 'sinergista', level: 1 },
      { muscle: 'soleo', role: 'estabilizador', level: 2 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      ...CUES,
      excentrica: [
        'Baja en 3 s manteniendo el talón apoyado: tu tobillo marca la profundidad.',
        'Rodillas en la dirección de los pies.',
      ],
    },
    windows: WINDOWS_PRENSA,
    errors: BASE_ERRORS,
  },
  {
    id: 'anchos',
    name: 'Pies anchos y abiertos',
    short: 'Pies anchos',
    description: 'Postura amplia con puntas a ~30°: más aductores y glúteo.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'aductores', role: 'principal', level: 3 },
      { muscle: 'gluteo_mayor', role: 'principal', level: 2 },
      { muscle: 'cuadriceps', role: 'principal', level: 2 },
      { muscle: 'gluteo_medio', role: 'estabilizador', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      ...CUES,
      concentrica: ['Empuja abriendo las rodillas hacia las puntas de los pies.', 'Espira al empujar.'],
    },
    windows: WINDOWS_PRENSA,
    errors: BASE_ERRORS,
  },
  {
    id: 'gemelo',
    name: 'Gemelo en prensa',
    short: 'Gemelo',
    description: 'Bola del pie en el borde inferior de la plataforma, rodillas casi extendidas: trabajo de tobillo.',
    tempo: { excentrica: 2, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 },
    muscles: [
      { muscle: 'gastrocnemio', role: 'principal', level: 3 },
      { muscle: 'soleo', role: 'principal', level: 2 },
      { muscle: 'cuadriceps', role: 'estabilizador', level: 1 },
    ],
    cues: {
      preparacion: ['Bola del pie en el borde inferior, talones libres.', 'Rodillas casi extendidas, sin bloquear.'],
      excentrica: ['Deja bajar los talones en 2 s hasta el estiramiento.'],
      pausa_estiramiento: ['1 s abajo sin rebote.'],
      concentrica: ['Empuja con la bola del pie hasta la máxima extensión del tobillo.'],
      pausa_contraccion: ['Aprieta 1 s arriba.'],
    },
    windows: [W_GEMELO.rodilla, W_GEMELO.estiramiento, W_GEMELO.contraccion],
    errors: ['bloqueo', 'rango_parcial'],
  },
];

export const prensaContent: StationContent = {
  id: 'prensa',
  name: 'Prensa de piernas 45°',
  short: 'Prensa',
  zone: 'pierna',
  family: 'carril',
  summary: 'Empuje de piernas en carril inclinado: cuádriceps y glúteo, con la pelvis como límite de profundidad.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['knee.flex', 'hip.flex', 'pelvis.tilt', 'knee.valgus', 'ankle.dorsi'],
  views: [
    { id: 'iso', label: 'Isométrica', azimuth: -130, elevation: 35.264 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
    { id: 'rodillas', label: 'Rodillas (desde la cabeza)', azimuth: 180, elevation: 52 },
    { id: 'superior', label: 'Superior', azimuth: -90, elevation: 89 },
  ],
  sources: [
    {
      id: 'escamilla2001',
      cite: 'Escamilla RF et al. (2001). Effects of technique variations on knee biomechanics during the squat and leg press. Med Sci Sports Exerc 33(9):1552–1566.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/11528346/',
    },
    {
      id: 'dasilva2008',
      cite: 'Da Silva EM et al. (2008). Analysis of muscle activation during different leg press exercises at submaximum effort levels. J Strength Cond Res 22(4):1059–1065.',
    },
    {
      id: 'hewett2005',
      cite: 'Hewett TE et al. (2005). Biomechanical measures of neuromuscular control and valgus loading of the knee predict ACL injury risk. Am J Sports Med 33(4):492–501.',
    },
    { id: 'mcgill', cite: 'McGill S. Low Back Disorders, 3.ª ed., Human Kinetics, 2016.' },
    { id: 'nsca', cite: 'Haff & Triplett (eds.), Essentials of Strength Training and Conditioning, 4.ª ed., NSCA, 2016.' },
  ],
  generalCues: [
    'La profundidad correcta la marca tu pelvis, no un número fijo: la app la calcula con tu talla, tu fémur y tu movilidad de cadera.',
    'Subir los pies traslada demanda de la rodilla a la cadera (mira las barras de momento articular).',
  ],
};
