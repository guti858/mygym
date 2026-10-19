# Máquina de fondos (libre · asistida · lastrada)

> **Borrador F0 para validar.** Se codificará en F4 con el mismo esquema que las estaciones implementadas (las métricas usan el vocabulario del motor: `shoulder.flex`, `scap.elev`, …). Los ángulos de hombro son humerotorácicos (incluyen la contribución de la escápula).

**Mecánica:** peso corporal (`BodyweightDriver`): las manos quedan fijas en las paralelas y el cuerpo se mueve. **Empieza en:** contracción (brazos extendidos arriba) → primero excéntrica.
**Carga:** masa corporal ± lastre (cinturón, 0–40 kg) o − asistencia (contrapeso en rodillera, 5–50 kg). Carga efectiva = masa − asistencia (+ lastre).

## Modalidades
| Modalidad | Tronco | Agarre | Codos | Énfasis |
|---|---|---|---|---|
| **Pectoral** | Inclinado 20–30° adelante, piernas flexionadas atrás | Paralelas algo más anchas que los hombros (si la máquina tiene agarres convergentes, parte ancha) | Algo abiertos (abducción 25–45°) | Pectoral esternal |
| **Tríceps** | Vertical (0–10°) | Estrecho, a la anchura de hombros | Pegados al tronco (abducción < 20°) | Tríceps |
| Modo de carga | Libre · asistida (rodillera con contrapeso) · lastrada | | | |

## Ajuste de la máquina
- **Altura de agarres** (si es regulable): que con los brazos extendidos los pies no toquen el suelo ni la plataforma.
- **Asistencia:** elegir el contrapeso que permita 6–12 repeticiones con la profundidad correcta; la rodillera bajo las rodillas con el tronco vertical.
- **Anchura:** en máquinas con agarres convergentes, la zona estrecha para tríceps y la ancha para pectoral.

## Guion por fases (tempo recomendado 3-0-1-1)
- **Preparación:** brazos extendidos sin bloquear, hombros lejos de las orejas (depresión escapular), abdomen firme.
- **Excéntrica:** bajar en 2–3 s hasta que el hombro quede a la altura del codo (húmero ~paralelo al suelo); escápulas abajo, sin «hundir» los hombros hacia delante.
- **Pausa en estiramiento:** breve, sin rebote.
- **Concéntrica:** empujar las paralelas hacia abajo, extender codos; en pectoral mantener la inclinación del tronco.
- **Pausa en contracción:** arriba sin bloquear los codos de golpe.

## Ventanas articulares
| Ventana | Métrica | Modalidad | Correcto | Aviso | Cuándo | Confianza |
|---|---|---|---|---|---|---|
| Profundidad: hombro sin extensión extrema | `shoulder.flex` (− = extensión) | Ambas | −65…30° | −80…40° | siempre | Consenso (McKenzie 2022: la extensión de hombro es la variable crítica) |
| Codo abajo ≈ 90° | `elbow.flex` | Ambas | 80…100° | 70…115° | estiramiento | Práctica |
| Arriba sin bloquear | `elbow.flex` | Ambas | 5…25° | 0…35° | contracción | Práctica |
| Hombros abajo | `scap.elev` | Ambas | −15…5° | −15…12° | siempre | Consenso |
| Hombros sin hundirse hacia delante | `scap.prot` | Ambas | −15…15° | −20…25° | siempre | Consenso |
| Inclinación del tronco | `trunk.incline` | Pectoral | 15…35° | 8…45° | siempre | Práctica |
| Inclinación del tronco | `trunk.incline` | Tríceps | −5…12° | −10…20° | siempre | Práctica |
| Codos pegados | `shoulder.abd` | Tríceps | 0…22° | 0…35° | movimiento | Práctica |
| Apertura de codos | `shoulder.abd` | Pectoral | 10…45° | 0…55° | movimiento | Práctica |
| Muñeca neutra | `wrist.ext` | Ambas | −10…20° | −20…35° | siempre | Práctica |
| Cuello neutro | `neck.flex` | Ambas | −10…15° | −20…25° | siempre | Práctica |

## Errores demostrables
| Error | Qué se ve | Consecuencia | Alerta en |
|---|---|---|---|
| Bajar demasiado | El hombro baja muy por debajo del codo | Extensión extrema de hombro con carga: estrés capsular anterior | `shoulder.flex` |
| Hombros encogidos / hundidos | Los hombros suben hacia las orejas y se adelantan | Peor posición glenohumeral, trapecio superior dominante | `scap.elev`, `scap.prot` |
| Codos abiertos (tríceps) | Los codos se separan del tronco | El trabajo pasa al pectoral y aumenta el estrés en el hombro | `shoulder.abd` |
| Balanceo de piernas | Impulso con piernas y tronco | Rango sin control y carga brusca en el hombro | `trunk.incline` |
| Bloqueo arriba | Extensión de codo completa y brusca | Impacto articular en el codo | `elbow.flex` |

## Músculos
| Músculo | Pectoral | Tríceps |
|---|---|---|
| Pectoral mayor (esternal) | Principal ■■■ | Sinergista ■■ |
| Pectoral mayor (clavicular) | Sinergista ■ | — |
| Tríceps braquial | Principal ■■ | Principal ■■■ |
| Deltoides anterior | Sinergista ■■ | Sinergista ■■ |
| Trapecio inferior (depresión) | Estabilizador ■ | Estabilizador ■ |
| Recto abdominal y oblicuos | Estabilizador ■ | Estabilizador ■ |

## Fuentes
- McKenzie A. et al. (2022). Bench, bar, and ring dips: do kinematics and muscle activity differ? Int J Environ Res Public Health 19(20):13211. https://pmc.ncbi.nlm.nih.gov/articles/PMC9603242/
- Haff & Triplett (eds.), Essentials of Strength Training and Conditioning, 4.ª ed., NSCA, 2016.
- AAOS / Greene & Heckman (1994): ROM normativo de extensión de hombro (~50–60° glenohumeral + contribución escapular).

## Preguntas para tu validación
- [ ] ¿Profundidad máxima «hombro a la altura del codo» para todos, o permitimos más en usuarios con buena movilidad?
- [ ] Los umbrales de inclinación del tronco (p. ej. «45°») no están bien respaldados por estudios: ¿los marcamos como práctica habitual (como ahora)?
- [ ] ¿Incluimos fondos en banco como modalidad o los dejamos fuera (requieren más extensión de hombro)?
