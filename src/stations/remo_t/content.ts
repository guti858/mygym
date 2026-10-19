import type { ErrorDef, JointWindow, MuscleActivation, StationContent, VariantContent } from '../../engine/types';
import { NSCA_SOURCE, SHARED_WINDOWS } from '../common';

const W = {
  lumbar: {
    id: 'lumbar',
    metric: 'lumbar.flex',
    ok: [-12, 6],
    warn: [-18, 12],
    at: 'siempre',
    label: 'Columna lumbar neutra',
    cue: 'Pecho alto y zona lumbar neutra: no redondees la espalda al bajar ni al tirar.',
    why: 'Con el tronco inclinado y carga en las manos, flexionar la columna lumbar aumenta mucho el estrés de los discos.',
    confidence: 'evidencia',
    sources: ['fenwick2009', 'mcgill2016'],
  },
  troncoLibre: {
    id: 'tronco',
    metric: 'trunk.incline',
    ok: [45, 65],
    warn: [35, 75],
    at: 'siempre',
    label: 'Ángulo de tronco estable',
    cue: 'Bisagra de cadera con el tronco a 45–65° de la vertical, y que no suba al tirar.',
    why: 'Levantar el tronco para mover la carga añade inercia y traslada el esfuerzo a la zona lumbar.',
    confidence: 'practica',
  },
  troncoApoyo: {
    id: 'pecho_apoyado',
    metric: 'trunk.incline',
    ok: [40, 55],
    warn: [32, 62],
    at: 'siempre',
    label: 'Pecho apoyado',
    cue: 'Esternón en la almohadilla durante toda la serie.',
    why: 'Despegar el pecho convierte el remo en un tirón con el tronco y pierde la ventaja del apoyo para la zona lumbar.',
    confidence: 'practica',
  },
  rodillas: {
    id: 'rodillas',
    metric: 'knee.flex',
    ok: [10, 35],
    warn: [5, 50],
    at: 'siempre',
    label: 'Rodillas semiflexionadas',
    cue: 'Rodillas algo flexionadas y peso en el centro del pie.',
    why: 'Con las rodillas bloqueadas la bisagra estira los isquiotibiales y tira de la pelvis hacia la retroversión.',
    confidence: 'practica',
  },
  escapulas: {
    id: 'escapulas_juntas',
    metric: 'scap.prot',
    ok: [-30, -8],
    warn: [-30, 0],
    at: 'contraccion',
    label: 'Escápulas juntas al final',
    cue: 'Junta las escápulas al final del tirón, 1 s.',
    why: 'La retracción escapular es lo que trabaja el trapecio medio y los romboides; sin ella el remo se queda en los brazos.',
    confidence: 'consenso',
    sources: ['nsca'],
  },
  extension: {
    id: 'extension_abajo',
    metric: 'elbow.flex',
    ok: [3, 25],
    warn: [0, 40],
    at: 'estiramiento',
    label: 'Brazos extendidos abajo',
    cue: 'Abajo, brazos extendidos y hombros algo adelantados, sin redondear la espalda.',
    why: 'Recorrido completo: el dorsal y los retractores trabajan también en estiramiento.',
    confidence: 'practica',
  },
} satisfies Record<string, JointWindow>;

const recorrido = (ok: readonly [number, number], warn: readonly [number, number], cue: string): JointWindow => ({
  id: 'recorrido_codo',
  metric: 'elbow.flex',
  ok,
  warn,
  at: 'contraccion',
  label: 'Recorrido del codo',
  cue,
  why: 'Llevar el maneral hasta el tronco completa el recorrido del dorsal y los retractores.',
  confidence: 'practica',
});

const cuello = () => SHARED_WINDOWS.cuello([-15, 15], [-30, 25]);
const hombros = () => SHARED_WINDOWS.hombrosAbajo([-15, 5], [-15, 12]);

const ERRORS: readonly ErrorDef[] = [
  {
    id: 'espalda_redondeada',
    label: 'Espalda redondeada',
    description: 'La columna lumbar se flexiona en la bisagra y al tirar.',
    consequence: 'Mayor estrés de los discos lumbares.',
    expect: ['lumbar.flex'],
  },
  {
    id: 'tiron_cadera',
    label: 'Tirón con la cadera',
    description: 'El tronco se levanta para mover la carga.',
    consequence: 'Inercia y carga lumbar; menos trabajo de la espalda alta.',
    expect: ['trunk.incline'],
  },
  {
    id: 'pecho_despegado',
    label: 'Pecho despegado',
    description: 'El pecho se separa de la almohadilla al tirar.',
    consequence: 'El tronco ayuda al tirón y se pierde la ventaja del apoyo.',
    expect: ['trunk.incline'],
  },
  {
    id: 'encogimiento',
    label: 'Hombros encogidos',
    description: 'Se rema con los hombros hacia las orejas.',
    consequence: 'Trapecio superior dominante.',
    expect: ['scap.elev'],
  },
  {
    id: 'cuello',
    label: 'Cuello en hiperextensión',
    description: 'Se mira al frente forzando el cuello hacia atrás.',
    consequence: 'Carga cervical.',
    expect: ['neck.flex'],
  },
  {
    id: 'recorrido_corto',
    label: 'Recorrido corto',
    description: 'El maneral no llega al tronco: los codos apenas pasan del cuerpo.',
    consequence: 'Menos trabajo de los retractores de la escápula.',
    expect: ['elbow.flex'],
  },
];

const TEMPO = { excentrica: 2, pausaEstiramiento: 1, concentrica: 1, pausaContraccion: 1 };

type Posture = 'apoyo' | 'libre';
type Grip = 'neutro' | 'prono';

function muscles(posture: Posture, grip: Grip): MuscleActivation[] {
  const back: MuscleActivation[] =
    grip === 'neutro'
      ? [
          { muscle: 'dorsal_ancho', role: 'principal', level: 3 },
          { muscle: 'trapecio_medio', role: 'principal', level: 3 },
          { muscle: 'deltoides_posterior', role: 'sinergista', level: 2 },
          { muscle: 'redondo_mayor', role: 'sinergista', level: 2 },
          { muscle: 'biceps', role: 'sinergista', level: 2 },
        ]
      : [
          { muscle: 'trapecio_medio', role: 'principal', level: 3 },
          { muscle: 'deltoides_posterior', role: 'sinergista', level: 3 },
          { muscle: 'dorsal_ancho', role: 'sinergista', level: 2 },
          { muscle: 'redondo_mayor', role: 'sinergista', level: 2 },
          { muscle: 'biceps', role: 'sinergista', level: 1 },
        ];
  const stab: MuscleActivation[] =
    posture === 'libre'
      ? [
          { muscle: 'erectores', role: 'estabilizador', level: 3 },
          { muscle: 'isquiotibiales', role: 'estabilizador', level: 2 },
          { muscle: 'gluteo_mayor', role: 'estabilizador', level: 2 },
        ]
      : [{ muscle: 'erectores', role: 'estabilizador', level: 1 }];
  return [...back, ...stab, { muscle: 'antebrazo', role: 'estabilizador', level: 2 }];
}

function variant(posture: Posture, grip: Grip): VariantContent {
  const libre = posture === 'libre';
  const neutro = grip === 'neutro';
  const codos = neutro ? 'Lleva los codos hacia la cadera, pegados al cuerpo.' : 'Lleva los codos hacia atrás y hacia los lados, abiertos.';
  return {
    id: `${posture}-${grip}`,
    name: `${libre ? 'Libre (bisagra)' : 'Con apoyo de pecho'} · ${neutro ? 'neutro estrecho' : 'prono ancho'}`,
    short: `${libre ? 'Libre' : 'Apoyo'} · ${neutro ? 'neutro' : 'prono'}`,
    description: `${libre ? 'Bisagra de cadera: exige además a la zona lumbar.' : 'Pecho apoyado: la zona lumbar descansa.'} ${
      neutro ? 'Neutro estrecho: más dorsal.' : 'Prono ancho: más trapecio medio y deltoides posterior.'
    }`,
    tempo: TEMPO,
    muscles: muscles(posture, grip),
    cues: {
      preparacion: [
        libre
          ? 'Pies a ambos lados de la palanca, rodillas semiflexionadas y bisagra de cadera.'
          : 'Esternón en la almohadilla, pies firmes y cabeza fuera del apoyo.',
        'Columna neutra: pecho alto, mirada al suelo algo adelantada, abdomen firme.',
      ],
      concentrica: ['Junta primero las escápulas.', codos, libre ? 'Sin levantar el tronco. Espira.' : 'Sin despegar el pecho. Espira.'],
      pausa_contraccion: ['1 s con las escápulas juntas.'],
      excentrica: ['Baja en 2 s sin perder la posición de la espalda. Inspira.'],
      pausa_estiramiento: ['Brazos extendidos y hombros algo adelantados, sin redondear la espalda.'],
    },
    windows: [
      W.lumbar,
      libre ? W.troncoLibre : W.troncoApoyo,
      ...(libre ? [W.rodillas] : []),
      W.escapulas,
      neutro
        ? recorrido([95, 125], [80, 135], 'Lleva el maneral hasta el abdomen, con los codos pasando el tronco.')
        : recorrido([85, 115], [70, 125], 'Lleva el maneral hasta la parte baja del pecho, con los codos abiertos.'),
      W.extension,
      hombros(),
      cuello(),
      SHARED_WINDOWS.muneca(),
    ],
    errors: libre ? ['espalda_redondeada', 'tiron_cadera', 'encogimiento', 'cuello', 'recorrido_corto'] : ['pecho_despegado', 'encogimiento', 'cuello', 'recorrido_corto'],
  };
}

const VARIANTS: readonly VariantContent[] = [variant('apoyo', 'neutro'), variant('apoyo', 'prono'), variant('libre', 'neutro'), variant('libre', 'prono')];

export const remoContent: StationContent = {
  id: 'remo_t',
  name: 'Remo en T',
  short: 'Remo en T',
  zone: 'traccion',
  family: 'pivote',
  summary: 'Tracción horizontal con una palanca anclada al suelo: dorsal y retractores de la escápula, con el pecho apoyado o en bisagra de cadera.',
  variants: VARIANTS,
  errors: ERRORS,
  keyMetrics: ['lumbar.flex', 'trunk.incline', 'elbow.flex', 'scap.prot', 'knee.flex'],
  views: [
    { id: 'lateral', label: 'Lateral', azimuth: -90, elevation: 8 },
    { id: 'iso', label: 'Isométrica', azimuth: -50, elevation: 30 },
    { id: 'posterior', label: 'Posterior', azimuth: 160, elevation: 25 },
    { id: 'superior', label: 'Superior', azimuth: 0, elevation: 89 },
  ],
  sources: [
    NSCA_SOURCE,
    {
      id: 'fenwick2009',
      cite: 'Fenwick CMJ, Brown SHM, McGill SM (2009). Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness. J Strength Cond Res 23(2):350–358.',
    },
    { id: 'mcgill2016', cite: 'McGill S. (2016). Low Back Disorders: Evidence-Based Prevention and Rehabilitation, 3.ª ed. Human Kinetics.' },
  ],
  generalCues: [
    'La versión con apoyo de pecho reduce mucho la carga lumbar; la libre trabaja además los extensores de la espalda y la cadera (Fenwick et al., 2009).',
    'La carga en las manos es algo mayor que la de los discos: van en el extremo de la palanca, por delante del maneral.',
  ],
};
