import type { ErrorDef, JointWindow, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE, SHARED_WINDOWS } from '../common';

const W = {
  extension: {
    id: 'extension_hombro',
    metric: 'shoulder.flex',
    ok: [-68, 30],
    warn: [-80, 40],
    at: 'siempre',
    label: 'Profundidad: hombro sin extensión extrema',
    cue: 'Baja hasta que el hombro quede a la altura del codo; no más.',
    why: 'La extensión de hombro es la variable crítica de los fondos: bajar de más estira la cápsula anterior con todo el peso del cuerpo.',
    confidence: 'consenso',
    sources: ['mckenzie2022'],
  },
  codoAbajo: {
    id: 'codo_abajo',
    metric: 'elbow.flex',
    ok: [80, 100],
    warn: [70, 115],
    at: 'estiramiento',
    label: 'Profundidad del codo',
    cue: 'Abajo, codos a unos 90° (algo menos con el tronco vertical) y antebrazos casi verticales.',
    why: 'Más flexión suele ir con más extensión de hombro; menos, con un recorrido incompleto.',
    confidence: 'practica',
  },
  hombrosAbajo: {
    id: 'hombros_abajo',
    metric: 'scap.elev',
    ok: [-15, 5],
    warn: [-15, 12],
    at: 'siempre',
    label: 'Hombros abajo',
    cue: 'Empuja las paralelas hacia abajo: hombros lejos de las orejas.',
    why: 'Hundirse entre los hombros (elevación escapular) es la posición de mayor estrés del hombro en los fondos.',
    confidence: 'consenso',
    sources: ['nsca'],
  },
  hombrosAdelante: {
    id: 'hombros_adelante',
    metric: 'scap.prot',
    ok: [-15, 15],
    warn: [-20, 25],
    at: 'siempre',
    label: 'Hombros sin hundirse hacia delante',
    cue: 'Pecho abierto: los hombros no caen hacia delante al bajar.',
    why: 'La protracción excesiva abajo cierra el espacio del hombro.',
    confidence: 'consenso',
  },
} satisfies Record<string, JointWindow>;

const tronco = (ok: readonly [number, number], warn: readonly [number, number], cue: string): JointWindow => ({
  id: 'tronco',
  metric: 'trunk.incline',
  ok,
  warn,
  at: 'siempre',
  label: 'Inclinación del tronco',
  cue,
  why: 'La inclinación decide el reparto entre pectoral (inclinado) y tríceps (vertical); balancearse quita control.',
  confidence: 'practica',
});

const codos = (ok: readonly [number, number], warn: readonly [number, number], label: string, cue: string): JointWindow => ({
  id: 'codos',
  metric: 'shoulder.flare',
  ok,
  warn,
  at: 'movimiento',
  label,
  cue,
  why: 'Abrir los codos traslada el trabajo al pectoral y aumenta el estrés en el hombro; pegarlos lo lleva al tríceps.',
  confidence: 'practica',
});

const codoAbajo = (ok: readonly [number, number], warn: readonly [number, number]): JointWindow => ({ ...W.codoAbajo, ok, warn });

const COMUNES: readonly JointWindow[] = [
  W.extension,
  SHARED_WINDOWS.codoArriba(),
  W.hombrosAbajo,
  W.hombrosAdelante,
  SHARED_WINDOWS.muneca(),
  SHARED_WINDOWS.cuello([-10, 15], [-20, 25]),
];

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'profundidad',
    label: 'Bajar demasiado',
    description: 'El hombro baja muy por debajo del codo.',
    consequence: 'Extensión extrema del hombro con carga: estrés de la cápsula anterior.',
    expect: ['shoulder.flex'],
  },
  {
    id: 'hombros',
    label: 'Hombros encogidos y hundidos',
    description: 'Los hombros suben hacia las orejas y caen hacia delante en la parte baja.',
    consequence: 'Peor posición del hombro y trapecio superior dominante.',
    expect: ['scap.elev', 'scap.prot'],
  },
  {
    id: 'codos_abiertos',
    label: 'Codos abiertos',
    description: 'En la modalidad de tríceps, los codos se separan del tronco.',
    consequence: 'El trabajo pasa al pectoral y aumenta el estrés en el hombro.',
    expect: ['shoulder.flare'],
  },
  {
    id: 'balanceo',
    label: 'Balanceo',
    description: 'Impulso con piernas y tronco para subir.',
    consequence: 'Recorrido sin control y cargas bruscas en el hombro.',
    expect: ['trunk.incline'],
  },
  {
    id: 'bloqueo',
    label: 'Bloqueo arriba',
    description: 'Extensión completa y brusca del codo al terminar.',
    consequence: 'Impacto articular en el codo.',
    expect: ['elbow.flex'],
  },
];

const TEMPO = { excentrica: 3, pausaEstiramiento: 0, concentrica: 1, pausaContraccion: 1 };

const VARIANTS: readonly VariantContent[] = [
  {
    id: 'pectoral',
    name: 'Fondos para pectoral',
    short: 'Pectoral',
    description: 'Tronco inclinado 20–30° adelante, paralelas algo más anchas que los hombros y codos algo abiertos.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'pectoral_esternal', role: 'principal', level: 3 },
      { muscle: 'triceps', role: 'principal', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 2 },
      { muscle: 'pectoral_clavicular', role: 'sinergista', level: 1 },
      { muscle: 'trapecio_inferior', role: 'estabilizador', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      preparacion: ['Brazos extendidos sin bloquear, hombros abajo.', 'Tronco inclinado hacia delante, piernas flexionadas atrás, abdomen firme.'],
      excentrica: ['Baja en 2–3 s manteniendo la inclinación del tronco.', 'Codos algo abiertos; para cuando el hombro llegue a la altura del codo. Inspira.'],
      concentrica: ['Empuja las paralelas hacia abajo y extiende los codos.', 'Mantén el pecho adelantado. Espira al subir.'],
      pausa_contraccion: ['Arriba, codos casi extendidos y hombros lejos de las orejas.'],
    },
    windows: [
      tronco([15, 35], [8, 45], 'Tronco inclinado 20–30° hacia delante durante todo el recorrido.'),
      codos([10, 45], [0, 55], 'Apertura de codos', 'Codos algo separados del tronco (25–45°).'),
      codoAbajo([80, 100], [70, 115]),
      ...COMUNES,
    ],
    errors: ['profundidad', 'hombros', 'balanceo', 'bloqueo'],
  },
  {
    id: 'triceps',
    name: 'Fondos para tríceps',
    short: 'Tríceps',
    description: 'Tronco vertical, paralelas estrechas (anchura de hombros) y codos pegados al tronco.',
    tempo: TEMPO,
    muscles: [
      { muscle: 'triceps', role: 'principal', level: 3 },
      { muscle: 'pectoral_esternal', role: 'sinergista', level: 2 },
      { muscle: 'deltoides_anterior', role: 'sinergista', level: 2 },
      { muscle: 'trapecio_inferior', role: 'estabilizador', level: 1 },
      { muscle: 'abdominales', role: 'estabilizador', level: 1 },
    ],
    cues: {
      preparacion: ['Brazos extendidos sin bloquear, hombros abajo.', 'Tronco vertical y piernas bajo el cuerpo, abdomen firme.'],
      excentrica: ['Baja en 2–3 s con el tronco vertical.', 'Codos pegados, apuntando atrás. Inspira.'],
      concentrica: ['Extiende los codos empujando las paralelas hacia abajo.', 'Sin balancear las piernas. Espira al subir.'],
      pausa_contraccion: ['Arriba, sin bloquear los codos de golpe.'],
    },
    windows: [
      tronco([-5, 12], [-10, 20], 'Tronco vertical (0–10°).'),
      codos([0, 22], [0, 35], 'Codos pegados', 'Codos cerca del tronco, apuntando atrás.'),
      codoAbajo([65, 95], [55, 110]),
      ...COMUNES,
    ],
    errors: ['profundidad', 'hombros', 'codos_abiertos', 'balanceo', 'bloqueo'],
  },
];

export const fondosContent: StationContent = {
  id: 'fondos',
  name: 'Máquina de fondos',
  short: 'Fondos',
  zone: 'empuje',
  family: 'corporal',
  summary: 'Empuje vertical con el propio cuerpo: pectoral o tríceps según la inclinación del tronco y la anchura, controlando la extensión del hombro.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['shoulder.flex', 'elbow.flex', 'trunk.incline', 'scap.elev', 'shoulder.flare'],
  views: [
    { id: 'iso', label: 'Isométrica', azimuth: -45, elevation: 25 },
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 0 },
    { id: 'frontal', label: 'Frontal', azimuth: 0, elevation: 10 },
    { id: 'posterior', label: 'Posterior', azimuth: 180, elevation: 10 },
  ],
  sources: [
    NSCA_SOURCE,
    {
      id: 'mckenzie2022',
      cite: 'McKenzie A. et al. (2022). Bench, bar, and ring dips: do kinematics and muscle activity differ? Int J Environ Res Public Health 19(20):13211.',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9603242/',
    },
    { id: 'aaos', cite: 'Greene WB, Heckman JD (eds.) (1994). The Clinical Measurement of Joint Motion. AAOS (ROM normativo de extensión de hombro).' },
  ],
  generalCues: [
    'La profundidad segura es «hombro a la altura del codo»: la extensión de hombro es lo que más cambia entre modalidades (McKenzie et al., 2022).',
    'Si no llegas a 6 repeticiones con buena técnica, usa la rodillera de asistencia; si haces más de 12, añade lastre.',
  ],
};
