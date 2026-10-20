/**
 * Genera la documentación revisable de las estaciones implementadas a partir del código
 * (contenido + simulación) y la matriz de cobertura muscular de las 12 estaciones.
 * Uso: npm run docs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { MUSCLES, MUSCLE_IDS, ROLE_LABEL } from '../src/content/muscles';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../src/engine/anthropometry';
import { evaluateFrame, startAtOf } from '../src/engine/evaluate';
import { describeLoad } from '../src/engine/load';
import { METRIC_INFO } from '../src/engine/metrics';
import { JOINT_MOMENT_LABEL } from '../src/engine/moments';
import { PHASE_LABEL, tempoToString, type PhaseKind } from '../src/engine/timeline';
import { CONFIDENCE_LABEL, type StationContent, type StationLogic } from '../src/engine/types';
import { abdAddContent } from '../src/stations/abd_add/content';
import { abdAddLogic } from '../src/stations/abd_add/logic';
import { CATALOG, ZONE_LABEL } from '../src/stations/catalog';
import { dominadasContent } from '../src/stations/dominadas/content';
import { dominadasLogic } from '../src/stations/dominadas/logic';
import { fondosContent } from '../src/stations/fondos/content';
import { fondosLogic } from '../src/stations/fondos/logic';
import { jalonContent } from '../src/stations/jalon/content';
import { jalonLogic } from '../src/stations/jalon/logic';
import { mancuernasContent } from '../src/stations/mancuernas/content';
import { mancuernasLogic } from '../src/stations/mancuernas/logic';
import { peckContent } from '../src/stations/peck_deck/content';
import { peckLogic } from '../src/stations/peck_deck/logic';
import { poleasContent } from '../src/stations/poleas/content';
import { poleasLogic } from '../src/stations/poleas/logic';
import { prensaContent } from '../src/stations/prensa/content';
import { prensaLogic } from '../src/stations/prensa/logic';
import { bancaContent } from '../src/stations/press_banca/content';
import { bancaLogic } from '../src/stations/press_banca/logic';
import { inclinadoContent } from '../src/stations/press_inclinado/content';
import { inclinadoLogic } from '../src/stations/press_inclinado/logic';
import { militarContent } from '../src/stations/press_militar/content';
import { militarLogic } from '../src/stations/press_militar/logic';
import { remoContent } from '../src/stations/remo_t/content';
import { remoLogic } from '../src/stations/remo_t/logic';

// Lógica y contenido sin los componentes 3D (modules.tsx arrastra React/three, innecesario aquí).
const STATIONS: Array<{ logic: StationLogic<unknown>; content: StationContent }> = [
  { logic: jalonLogic as StationLogic<unknown>, content: jalonContent },
  { logic: prensaLogic as StationLogic<unknown>, content: prensaContent },
  { logic: bancaLogic as StationLogic<unknown>, content: bancaContent },
  { logic: inclinadoLogic as StationLogic<unknown>, content: inclinadoContent },
  { logic: militarLogic as StationLogic<unknown>, content: militarContent },
  { logic: peckLogic as StationLogic<unknown>, content: peckContent },
  { logic: fondosLogic as StationLogic<unknown>, content: fondosContent },
  { logic: dominadasLogic as StationLogic<unknown>, content: dominadasContent },
  { logic: remoLogic as StationLogic<unknown>, content: remoContent },
  { logic: poleasLogic as StationLogic<unknown>, content: poleasContent },
  { logic: abdAddLogic as StationLogic<unknown>, content: abdAddContent },
  { logic: mancuernasLogic as StationLogic<unknown>, content: mancuernasContent },
];

/** Preguntas concretas para la validación del usuario, por estación. */
const QUESTIONS: Record<string, string[]> = {
  jalon: [
    '¿Te parece correcta la inclinación de tronco permitida (hasta 30° atrás) o prefieres un máximo más estricto (p. ej. 20°)?',
    '¿Mantener el jalón tras nuca solo como «error demostrable» (no como variante) es el enfoque que quieres?',
    '¿El recorrido completo debe exigir que la barra toque el pecho, o basta con llevarla a la barbilla para algunos perfiles?',
    '¿Añadimos una variante de agarre prono estrecho?',
  ],
  prensa: [
    'La profundidad «ideal» se limita automáticamente por la movilidad de cadera (por defecto 120°) y la flexión dorsal (40°). ¿Te parecen razonables esos valores por defecto?',
    'Con pies medios, la simulación llega a ~83° de rodilla para 175 cm. ¿Esperas más profundidad como objetivo (90°) aunque implique más flexión de cadera?',
    'Arriba se deja ≥5° de flexión de rodilla. ¿Prefieres un margen mayor (10°)?',
    '¿Quieres la variante unilateral en esta primera versión?',
  ],
  press_banca: [
    'Cambio respecto al borrador F0: la profundidad (codo abajo) pasa de 75–110° a **100–142°**. Con la barra tocando el esternón bajo y los antebrazos verticales, la simulación da ~130–135° de flexión de codo (175 cm). ¿Lo aceptas?',
    '¿Arco lumbar: lo limitamos (como ahora, −25°) o lo dejamos libre mientras los glúteos sigan apoyados?',
    '¿Tempo con pausa en el pecho (3-1-1-0) o sin pausa (3-0-1-0)?',
    'El error «Glúteos despegados» se detecta por la extensión de cadera (fuera de −8…45°) y por el arco lumbar. ¿Te sirve este criterio?',
  ],
  press_inclinado: [
    '¿Inclinación del respaldo fija a 30° (donde la literatura sitúa el mayor énfasis clavicular sin disparar el deltoides) o regulable?',
    'Nueva ventana respecto al borrador F0: **altura de las manos al inicio** (elevación del brazo: prono 30–58°, neutro 20–44°), que detecta el asiento demasiado bajo. ¿La mantenemos?',
    'Con brazos cortos (P5), el arco de la máquina queda lejos del hombro: la simulación baja el asiento una o dos posiciones para poder empezar con los codos poco por detrás del tronco. ¿Es el ajuste que harías tú, o prefieres indicar otra solución (p. ej. adelantar el inicio de la palanca)?',
  ],
  press_militar: [
    'Cambio respecto al borrador F0: la profundidad (codo abajo) pasa de 80–110° a **108–138°**. Con las manos a la altura de la barbilla, la simulación da ~120° de flexión de codo. ¿Lo aceptas?',
    '¿Profundidad hasta la barbilla para todos o permitimos bajar hasta los hombros si hay buena movilidad?',
    'El respaldo se ha dejado a 5° de inclinación. ¿Prefieres vertical (0°) o algo más reclinado (10–15°)?',
  ],
  peck_deck: [
    'Cambio respecto al borrador F0: la altura de los brazos se mide como **elevación del brazo (62–92°)** en lugar de abducción, porque con los brazos al frente la abducción no está definida. ¿Te parece bien?',
    '¿Ambas modalidades con manetas, o la versión de codos en almohadillas como alternativa?',
    'El eje de la máquina es fijo y las escápulas se mueven poco (8–10°); aun así el codo pasa de ~20° a ~34° en las aperturas porque el hombro se acerca al maneral. ¿Aceptamos ese margen en «Codos fijos» (10–35°)?',
    'En aperturas, las manos se juntan delante del pecho y el inicio queda en el plano del cuerpo (no por detrás). ¿Quieres permitir algo más de estiramiento (hasta 10–15° por detrás)?',
  ],
  fondos: [
    'Nueva métrica respecto al borrador F0: **apertura de los codos** (ángulo del brazo hacia fuera del plano sagital), porque la abducción clásica no es fiable con el brazo horizontal. Pectoral 10–45°, tríceps 0–22°. ¿Te parecen razonables?',
    'Cambio respecto al borrador F0: en tríceps (tronco vertical) la profundidad pasa a **65–95°** de flexión de codo; en pectoral se mantiene 80–100°. ¿Lo aceptas?',
    '¿Profundidad máxima «hombro a la altura del codo» para todos, o permitimos más en usuarios con buena movilidad?',
    'Los umbrales de inclinación del tronco (pectoral 15–35°, tríceps −5…12°) no están bien respaldados por estudios: ¿los marcamos como práctica habitual (como ahora)?',
    '¿Incluimos fondos en banco como modalidad o los dejamos fuera (requieren más extensión de hombro)?',
  ],
  dominadas: [
    'Cambio respecto al borrador F0: el recorrido arriba (barbilla sobre la barra) se mide con la flexión de codo **según el agarre**: prona ancha 122–152°, supina 130–160°, neutra 128–160°. La simulación da 129–137° (prona) y 140–148° (supina) con la barbilla justo por encima de la barra. ¿Lo aceptas?',
    '¿Exigimos «colgado activo» abajo (escápula elevada como mucho 15°) o aceptamos el colgado pasivo como correcto (es habitual y no está claro que sea perjudicial)?',
    '¿Barbilla sobre la barra (como ahora) o pecho a la barra como criterio de recorrido completo?',
    'La asistencia se representa con la rodillera de una máquina con contrapeso. ¿Añadimos la versión con banda elástica (ayuda mayor abajo que arriba)?',
  ],
  remo_t: [
    '¿Mantenemos las dos posturas (con apoyo de pecho y libre en bisagra) en la v1? Están implementadas ambas, cada una con los dos agarres.',
    'Tronco en la versión libre: 45–65° desde la vertical (la técnica ideal va de 54° a 50°). ¿Te parece adecuado?',
    'Cambio respecto al borrador F0: el recorrido del codo arriba depende del agarre: neutro 95–125°, prono ancho 85–115° (en F0, 80–130° para ambos). ¿Lo aceptas?',
    'El maneral va sobre un soporte 24 cm por encima de la palanca para que los discos pasen por debajo del tronco (con el maneral bajo la palanca, los discos chocan con el pecho al final). ¿Representa bien la máquina de tu gimnasio?',
    'Errores nuevos respecto a F0: «pecho despegado» (versión con apoyo) y «recorrido corto». ¿Los mantenemos?',
  ],
  poleas: [
    'Modalidades implementadas: curl con barra recta, curl martillo con cuerda, tríceps en polea alta (barra recta) y tríceps sobre la cabeza (cuerda). ¿Añadimos el curl con barra EZ y el curl unilateral con agarre D, o la extensión en polea alta con cuerda?',
    'Cambio respecto al borrador F0: en la extensión sobre la cabeza, «hombros abajo» pasa a −5…18°: con los brazos arriba la escápula se eleva y rota de forma natural. ¿Lo aceptas?',
    'La polea se ha supuesto 2:1 (en el agarre, la mitad del peso de la pila). ¿Es así en la columna de tu gimnasio o es 1:1?',
    'Curl: el error «codos que avanzan» se marca a partir de 20° de flexión de hombro (aviso hasta 35°). ¿Te parece bien el umbral?',
    'Cambio respecto al borrador F0: en la polea alta, «codo fijo» pasa a −10…22° (en F0, −15…15°). Con los codos pegados pero algo por delante del tronco (13° en la técnica ideal), la barra baja por delante de los muslos y el cable sube por delante del pecho; con el codo alineado con el tronco, la barra chocaría con los muslos. ¿Lo aceptas?',
  ],
  abd_add: [
    '¿Incluimos la abducción con tronco inclinado aunque su respaldo sea sobre todo práctico? (Está implementada: tronco a ~30° hacia delante y sin apoyo.)',
    '¿Rango final de abducción 30–50° te parece adecuado? La técnica ideal abre hasta 40° por pierna.',
    'Nueva ventana respecto al borrador F0: **rodillas a unos 90°** (70–110°), porque las almohadillas y los reposapiés fijan la rodilla. ¿La mantenemos?',
    'En aducción, el rango inicial se ajusta con el pasador (36° por pierna en la técnica ideal; el error lo lleva a 58°). ¿Es la apertura de partida que recomendarías?',
  ],
  mancuernas: [
    '¿Estos 7 ejercicios son los que quieres en la v1? (El peso muerto rumano cubre isquiotibiales, que es el grupo más débil del resto del gimnasio.)',
    'Cambio respecto al borrador F0: la carga avanza de **2 en 2 kg** en todo el rango (2–50 kg); en F0 eran 2 kg hasta 10 kg y 2,5 kg después. ¿Prefieres el salto de 2,5 kg (12,5 · 15 · 17,5…)?',
    '¿Elevaciones laterales hasta 90° o permitimos algo más con buena rotación escapular?',
    'Ventanas nuevas respecto al borrador F0: **profundidad** en el press inclinado (codo 80–115° abajo; la simulación da ~100° con las mancuernas a los lados del pecho alto y los codos a 60° del tronco) y en la goblet (rodilla 95–125°), **recorrido del codo** en el remo (80–120° arriba) y **extensión abajo** en el curl (0–20°). ¿Las mantenemos?',
    'Remo unilateral: rema el brazo derecho con la rodilla y la mano izquierdas en el banco; la escápula y el codo se miden solo en ese lado. El error «rotar el tronco» se muestra como el tronco que se levanta (el motor no simula aún la rotación axial del tronco). ¿Te sirve así?',
    'Press de hombro: el húmero sube en el plano de la escápula (30° por delante del plano frontal), con el respaldo a 85°. ¿Prefieres los codos en el plano frontal?',
  ],
};

const fmt = (n: number) => (Math.abs(n) < 0.05 ? '0' : n.toFixed(0));
const esc = (s: string) => s.replace(/\|/g, '\\|');

function stationDoc({ logic, content }: { logic: StationLogic<unknown>; content: StationContent }): string {
  const out: string[] = [];
  const p50 = ANTHRO_TEST_PROFILES.p50!;
  out.push(`# ${content.name}`);
  out.push('');
  out.push(`> Documento **generado desde el código** (\`src/stations/${content.id}/content.ts\` y \`logic.ts\`) con \`npm run docs\`. Para validarlo, anota tus cambios aquí (o en comentarios) y se trasladan al código; después se regenera.`);
  out.push('');
  out.push(`**Resumen:** ${content.summary}  `);
  out.push(`**Zona:** ${ZONE_LABEL[content.zone]} · **Mecánica:** ${content.family} · **Carga:** ${logic.load.label} · **Empieza en:** ${logic.startAtFor ? 'según la modalidad' : logic.startAt === 'estiramiento' ? 'estiramiento (primero concéntrica)' : 'contracción (primero excéntrica)'}`);
  out.push('');
  out.push('## Claves generales');
  for (const c of content.generalCues) out.push(`- ${c}`);
  out.push('');
  out.push('## Variantes');
  out.push('| Variante | Descripción | Tempo (exc-pausa-conc-pausa) | Errores demostrables |');
  out.push('|---|---|---|---|');
  for (const v of content.variants) {
    out.push(`| **${v.name}** (\`${v.id}\`) | ${esc(v.description)} | ${tempoToString(v.tempo)} | ${v.errors.map((e) => content.errors.find((x) => x.id === e)!.label).join(', ')} |`);
  }
  out.push('');

  for (const v of content.variants) {
    out.push(`## ${v.name}`);
    out.push('');
    out.push('### Ajuste de la máquina según la talla');
    const profiles: Array<[string, string]> = [
      ['p5', '150 cm'],
      ['p50', '175 cm'],
      ['p95', '195 cm'],
      ['rigido', '175 cm, poca movilidad'],
    ];
    const first = evaluateFrame(logic, content, { anthro: p50, seg: computeSegments(p50), variantId: v.id, errorId: null, loadKg: logic.defaultLoadKg, p: 0, phase: 'preparacion' });
    const labels = first.setup.map((l) => l.label).filter((l) => l !== 'Carga');
    out.push(`| Perfil | ${labels.join(' | ')} |`);
    out.push(`|---|${labels.map(() => '---').join('|')}|`);
    for (const [id, name] of profiles) {
      const anthro = ANTHRO_TEST_PROFILES[id]!;
      const r = evaluateFrame(logic, content, { anthro, seg: computeSegments(anthro), variantId: v.id, errorId: null, loadKg: logic.defaultLoadKg, p: 0, phase: 'preparacion' });
      out.push(`| ${name} | ${labels.map((l) => esc(r.setup.find((x) => x.label === l)?.value ?? '')).join(' | ')} |`);
    }
    out.push('');
    out.push(`Carga por defecto: ${describeLoad(logic.load, logic.defaultLoadKg, p50.massKg).detail}.`);
    out.push('');

    out.push('### Guion por fases');
    const order: PhaseKind[] =
      startAtOf(logic, v.id) === 'estiramiento'
        ? ['preparacion', 'concentrica', 'pausa_contraccion', 'excentrica', 'pausa_estiramiento']
        : ['preparacion', 'excentrica', 'pausa_estiramiento', 'concentrica', 'pausa_contraccion'];
    for (const k of order) {
      const cues = v.cues[k] ?? [];
      if (!cues.length) continue;
      out.push(`- **${PHASE_LABEL[k]}:** ${cues.join(' · ')}`);
    }
    out.push('');

    out.push('### Ventanas articulares');
    out.push('| Ventana | Métrica | Correcto | Aviso (fuera = riesgo) | Cuándo | Confianza | Señal técnica | Por qué |');
    out.push('|---|---|---|---|---|---|---|---|');
    for (const w of v.windows) {
      out.push(
        `| ${w.label} | ${METRIC_INFO[w.metric].label} | ${w.ok[0]}…${w.ok[1]}° | ${w.warn[0]}…${w.warn[1]}° | ${w.at} | ${CONFIDENCE_LABEL[w.confidence]}${w.sources?.length ? ` (${w.sources.join(', ')})` : ''} | ${esc(w.cue)} | ${esc(w.why)} |`,
      );
    }
    out.push('');

    out.push('### Ángulos simulados (175 cm, técnica ideal)');
    const keys = [...new Set([...content.keyMetrics, ...v.windows.map((w) => w.metric)])];
    out.push(`| Posición | ${keys.map((k) => METRIC_INFO[k].label).join(' | ')} | Momentos (N·m) |`);
    out.push(`|---|${keys.map(() => '---').join('|')}|---|`);
    for (const [label, p] of [
      ['Estiramiento (p=0)', 0],
      ['Mitad (p=0,5)', 0.5],
      ['Contracción (p=1)', 1],
    ] as const) {
      const r = evaluateFrame(logic, content, { anthro: p50, seg: computeSegments(p50), variantId: v.id, errorId: null, loadKg: logic.defaultLoadKg, p, phase: 'concentrica' });
      const vals = keys.map((k) => {
        const l = r.metrics[`${k}.L`];
        return fmt(l ?? r.metrics[k] ?? 0);
      });
      const mom = Object.entries(r.moments)
        .filter(([, m]) => m > 0.5)
        .map(([j, m]) => `${JOINT_MOMENT_LABEL[j as keyof typeof JOINT_MOMENT_LABEL]} ${m.toFixed(0)}`)
        .join(', ');
      out.push(`| ${label} | ${vals.join(' | ')} | ${mom} |`);
    }
    out.push('');

    out.push('### Músculos');
    out.push('| Músculo | Papel | Implicación (1–3) |');
    out.push('|---|---|---|');
    for (const m of [...v.muscles].sort((a, b) => b.level - a.level)) out.push(`| ${MUSCLES[m.muscle].name} | ${ROLE_LABEL[m.role]} | ${'■'.repeat(m.level)} |`);
    out.push('');
  }

  out.push('## Errores demostrables');
  out.push('| Error | Qué se ve | Consecuencia | Alerta en |');
  out.push('|---|---|---|---|');
  for (const e of content.errors) out.push(`| **${e.label}** (\`${e.id}\`) | ${esc(e.description)} | ${esc(e.consequence)} | ${e.expect.map((m) => METRIC_INFO[m].label).join(', ')} |`);
  out.push('');
  out.push('## Fuentes');
  for (const s of content.sources) out.push(`- \`${s.id}\` — ${s.cite}${s.url ? ` ${s.url}` : ''}`);
  out.push('');
  out.push('## Preguntas para tu validación');
  for (const q of QUESTIONS[content.id] ?? []) out.push(`- [ ] ${q}`);
  out.push('');
  return out.join('\n');
}

function matrixDoc(): string {
  const out: string[] = [];
  out.push('# Matriz de cobertura muscular');
  out.push('');
  out.push('> Generada con `npm run docs` desde `src/stations/catalog.ts`. **P** = motor principal, **s** = secundario. ● = implementada · ○ = pendiente de los siguientes lotes de F4.');
  out.push('');
  const cols = CATALOG.map((c) => `${c.ready ? '●' : '○'} ${c.short}`);
  out.push(`| Músculo | ${cols.join(' | ')} | Cobertura |`);
  out.push(`|---|${cols.map(() => ':-:').join('|')}|---|`);
  for (const m of MUSCLE_IDS) {
    let p = 0;
    let s = 0;
    const cells = CATALOG.map((c) => {
      if (c.principal.includes(m)) {
        p++;
        return 'P';
      }
      if (c.secundarios.includes(m)) {
        s++;
        return 's';
      }
      return '';
    });
    const cov = p >= 2 ? 'Buena' : p === 1 ? 'Suficiente' : s > 0 ? 'Solo secundaria' : '**Sin cubrir**';
    out.push(`| ${MUSCLES[m].name} | ${cells.join(' | ')} | ${cov} |`);
  }
  out.push('');
  out.push('Notas: el core (abdominales, erectores) trabaja como estabilizador en casi todas las estaciones aunque no figure como principal. El sóleo y el serrato quedan cubiertos solo de forma secundaria.');
  out.push('');
  return out.join('\n');
}

mkdirSync('docs/stations', { recursive: true });
for (const st of STATIONS) {
  writeFileSync(`docs/stations/${st.content.id}.md`, stationDoc(st));
  console.log(`docs/stations/${st.content.id}.md`);
}
writeFileSync('docs/muscles-matrix.md', matrixDoc());
console.log('docs/muscles-matrix.md');
