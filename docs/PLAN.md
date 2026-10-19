# MyGym · Guion articular — Plan de proyecto (v1, pendiente de aprobación)

> Estado: **APROBADO (v1.1)** con las decisiones de la sección 9. **F0–F3 entregadas** y pendientes de validación (ver [`VALIDACION.md`](VALIDACION.md)). Siguiente: F4.

---

## 1. Visión

Una app web con escenario **isométrico** de un gimnasio. Cada máquina es una **estación** donde un avatar ejecuta el ejercicio siguiendo un **guion articular**: fases, ángulos objetivo por articulación, rangos seguros, señales técnicas (*cues*) y errores típicos que se pueden **mostrar a propósito** para ver qué articulación sufre. En cada estación se puede cambiar **carga** y **agarre/modalidad**, y el guion, la cinemática y el mapa muscular se recalculan.

Objetivo pedagógico: que la persona sepa *qué hace cada articulación en cada fase* y por qué, para entrenar con buena técnica y reducir molestias.

**Lo que no es:** ni un dispositivo médico ni un simulador físico de dinámica. Es una herramienta educativa con estimaciones biomecánicas simplificadas que cita sus fuentes.

---

## 2. Proyectos similares evaluados (qué tomamos y qué no)

| Proyecto | Qué hace bien | Qué le falta para este caso | Qué tomamos |
|---|---|---|---|
| **Muscle & Motion: Strength** (app móvil, cerrada) | Animaciones 3D, músculos coloreados por rol (motor principal, sinergista, estabilizador, antagonista), muestra cómo cambian los músculos al cambiar postura o agarre | No permite configurar la máquina, la carga ni la antropometría; no hay ventanas articulares numéricas | Código de colores por **rol muscular**, modalidad → cambio de músculos |
| **MuscleWiki** | Mapa corporal interactivo: tocas un músculo y te da ejercicios, con filtro por material | Funciona con vídeos y no explica nada a nivel articular | **Filtro por músculo** desde un mapa corporal en el hub |
| **wger / free-exercise-db / ExerciseDB** | Datos abiertos con `primaryMuscles` / `secondaryMuscles`, equipamiento e instrucciones | No traen cinemática ni ángulos | Vocabulario muscular normalizado (y quizá datos semilla, revisando licencias) |
| **react-body-highlighter** (y su origen react-native-body-highlighter, MIT) | SVG del cuerpo de frente y de espalda, por regiones musculares | Solo 2D | **Mapa muscular 2D** como leyenda (o un SVG propio si la licencia no encaja) |
| **FormCheck / ShadowCoach** (MediaPipe) | Ángulos articulares por *landmarks*, umbrales y una máquina de estados de fases con histéresis | Analizan vídeo; no enseñan la técnica ideal | Idea de **ventanas angulares + máquina de estados de fases**. A futuro, un modo cámara que use las mismas ventanas |
| **OpenSim** | Modelo musculoesquelético de nivel de investigación; momentos articulares dibujados como flechas | Escritorio, pesado, curva de aprendizaje alta | Visualizar la **demanda articular (momento)** como flechas o barras, en versión simplificada |
| **Gym Simulator 24 / juegos tipo "tycoon"** | Distribución del gimnasio, colocar máquinas, estética de juego | No enseñan técnica | Estética de **hub navegable** (sin la parte de gestión) |
| **Mundos isométricos en three.js** (p. ej. "Discount Elysium") | Cámara ortográfica isométrica con personaje | No tratan de fitness | Referencia técnica de cámara y escena |

**Hueco que cubrimos:** ninguno de estos combina (a) ajuste concreto de cada máquina, (b) un guion por articulación con ventanas seguras, (c) modalidades que recalculan la cinemática, (d) errores que se pueden enseñar y (e) un ajuste personalizado según la antropometría.

---

## 3. Decisiones técnicas

| Decisión | Elección | Motivo |
|---|---|---|
| Render | **3D low-poly con cámara ortográfica isométrica** (three.js) | Con *sprites* 2D habría que dibujar cada fotograma por variante, agarre y cuerpo, una explosión combinatoria. Además, en 3D se ven los ángulos reales desde varios planos |
| Framework | **Vite + TypeScript + React + @react-three/fiber + drei + zustand** | 12 estaciones con paneles: hace falta un sistema de componentes y un estado único |
| Assets | **Geometría procedural** (sin modelos externos) a partir de un *kit* de piezas | Coherencia visual entre estaciones, sin problemas de licencias, todo parametrizable |
| Avatar | **Maniquí articulado procedural** (tipo maniquí de dibujo) con "carcasas" musculares superpuestas | Las articulaciones se ven bien, que es justo el foco del proyecto |
| Movimiento | **Guiado por datos**: la máquina mueve sus puntos de contacto, la IK coloca el cuerpo y los fotogramas clave solo se usan para tronco, escápula y cabeza | Evita animar a mano 12 estaciones × variantes |
| Animación | **Remotion** (`@remotion/player` + `@remotion/three`): cada estación es una *composición* cuyo fotograma (`useCurrentFrame`) determina la fase y la pose. El Player embebido da reproducir/pausa/arrastrar/velocidad, y la misma composición se puede **exportar a MP4** desde Remotion Studio/CLI | Animación determinista (fotograma → pose), línea de tiempo nativa y vídeos de cada técnica para compartir. Licencia de Remotion: gratuita para particulares y empresas de ≤3 personas |
| "Terminal" | **Híbrido**: app web + **consola de comandos** integrada (tecla `:` o `~`) con autocompletado, y tema visual "terminal" opcional | Cumple "tipo terminal/app-web". Comandos y botones ejecutan las mismas acciones |
| Estado/URL | Rutas *hash* que codifican el estado (`#/estacion/jalon?agarre=supino&carga=45`) | Enlaces compartibles y reproducibles |
| Persistencia | `localStorage` (antropometría, últimas cargas), con *fallback* | No hace falta backend |
| Tests | **Vitest** (motor y contenido) + **Playwright** (humo E2E) | El motor biomecánico es lógica pura y se puede probar |
| Despliegue | Estático en **GitHub Pages** mediante Actions | Gratis y sin servidor |
| Idioma | Español, preparado para i18n | — |

---

## 4. Arquitectura: un motor común y 12 módulos

### 4.1 Avatar y articulaciones
- **Segmentos** con longitudes parametrizadas por talla y proporciones (cocientes antropométricos de Winter / Drillis-Contini). Rango probado: **P5 mujer (~150 cm) a P95 hombre (~195 cm)**, con ajustes para fémur largo o corto y brazo largo o corto.
- **Grados de libertad** en términos clínicos, con una convención ISB simplificada:
  - Pelvis: anteversión/retroversión, inclinación y rotación
  - Columna en 3 tramos (lumbar, torácica, cervical): flexión/extensión, inclinación y rotación, repartidas por tramo
  - **Escápula**: elevación/depresión, protracción/retracción, rotación superior/inferior
  - Hombro (glenohumeral): flexión/extensión, abducción/aducción, abducción/aducción horizontal, rotación interna/externa
  - Codo: flexión. Antebrazo: pronación/supinación. Muñeca: flexión/extensión y desviación
  - Cadera: 3 grados de libertad. Rodilla: flexión. Tobillo: flexión dorsal/plantar
- **ROM normativo** (AAOS / Soucie 2011) como límite anatómico duro, y **ventanas de entrenamiento** propias de cada ejercicio como límite técnico.
- **Ritmo escapulohumeral** (~2:1 a partir de unos 30° de elevación, Inman). Sin él, el hombro se ve robótico y enseña una mecánica equivocada.

### 4.2 Cinemática
- FK para todo el cuerpo y **IK analítica de dos huesos** (brazos y piernas) con vector polar, que controla hacia dónde apuntan codo y rodilla.
- Restricciones de contacto: manos en el agarre (que fija pronación o supinación), pies en la plataforma o el suelo, pelvis en el asiento, pecho o espalda contra el respaldo.
- **Medición de ángulos en 3D**, que no depende de la vista: el ángulo mostrado es el anatómico real aunque la cámara esté en isométrica.

### 4.3 Cinco "familias de mecánica" (coherencia entre estaciones)
Cada familia es **un único controlador** reutilizable. El progreso del movimiento `t ∈ [0,1]` mueve los contactos y la IK resuelve el cuerpo.

| Familia | Controlador | Estaciones |
|---|---|---|
| Cable/polea | `CableDriver` (agarre en la línea polea→mano, relación 1:1 o 2:1) | Jalón al pecho, Poleas bíceps/tríceps |
| Palanca con pivote (pila o discos) | `PivotDriver` (brazo que gira alrededor de un eje; en el remo en T el eje está en el suelo) | Press militar máquina, Press inclinado de pecho, Peck-deck, Abductores/aductores, Remo en T |
| Carril lineal + discos | `RailDriver` (trineo sobre un carril con ángulo) | Prensa de pierna 45° |
| Peso libre | `FreeWeightDriver` (trayectoria técnica de barra o mancuerna, p. ej. la curva en J del press banca) | Press banca con barra, Rack de mancuernas |
| Peso corporal | `BodyweightDriver` (**las manos quedan fijas y se mueve el cuerpo**: IK invertida) | Fondos, Dominadas |

### 4.4 Sistema de carga (qué cambia al tocar el peso)
- **Tipos:** pila de placas (pasador visual, incrementos configurables), discos (barra de 20 kg con discos por lado en colores IWF y cálculo automático de la combinación), peso corporal ± lastre o asistencia, y pares de mancuernas (2–50 kg).
- **Efectos:**
  1. Representación visual exacta.
  2. **Carga nominal frente a efectiva** según la relación mecánica de la máquina.
  3. **Demanda articular estimada**: momento estático ≈ |r × F| en las articulaciones clave, mostrado como barras relativas. Por ejemplo, subir los pies en la prensa traslada demanda de la rodilla a la cadera.
  4. %1RM si el usuario introduce su 1RM.
  5. *Cues* propios de cargas altas.
- **Aclaración:** no se simula fatiga ni dinámica. La carga no deforma la técnica ideal; solo los errores que se activan a propósito lo hacen.

### 4.5 Guion articular (el núcleo del contenido)
Cada variante declara:
- **Ajuste previo (setup)**: altura del asiento, rodillo y polea, *calculados a partir de la antropometría* (p. ej. "asiento en posición 4: con tu fémur, las manos quedan a la altura del pecho medio").
- **Fases**: preparación → excéntrica → transición → concéntrica → final, con **tempo** (p. ej. 3-1-1-0) y respiración.
- **Ventanas por articulación y fase** (mín/máx en grados, con severidad).
- ***Cues*** cortos por articulación y fase.
- **Errores típicos** (≥3 por variante): su firma articular, como desplazamientos de ángulo o la relajación de una restricción. Al activarse, el avatar comete el error y se enciende la alerta correspondiente.
- **Mapa muscular** por fase: rol (principal/sinergista/estabilizador) e intensidad cualitativa 0–3. **Nada de cifras de EMG inventadas.**
- **Fuentes** y un **nivel de confianza** (`evidencia` / `consenso` / `práctica`) en cada ventana y cada *cue*.

### 4.6 Interfaz común a todas las estaciones (misma disposición siempre)
- **Izquierda**: variante/agarre, carga, tempo, antropometría, botón "mostrar error".
- **Centro**: vista 3D: isométrica, sagital, frontal, superior y órbita libre. Transportadores angulares dibujados sobre cada articulación.
- **Derecha**: guion de la fase activa (*cues*, checklist de ajuste).
- **Abajo**: línea de tiempo por fases (reproducir, pausar, avanzar por fase, arrastrar), indicadores de ángulo y barras de demanda articular.
- **Superpuesto**: mapa muscular 2D (frente/espalda) sincronizado con las carcasas musculares del avatar.
- **Semántica de colores**: verde dentro de la ventana, ámbar cerca del límite, rojo fuera. Siempre con **icono y texto** además del color (accesibilidad).

### 4.7 Hub isométrico
- Planta de unos 20×14 m con **zonas**: Empuje · Tracción · Brazos · Pierna · Zona libre (mancuernas).
- Al pasar el ratón: nombre y grupos musculares. Al hacer clic: transición de cámara hacia la estación.
- Filtro por músculo: tocar un músculo en el mapa ilumina las estaciones que lo trabajan, coloreadas según el rol.
- Rotación de cámara en saltos de 90° (clásico isométrico). Más adelante, un avatar que camina hasta la estación.

### 4.8 Consola (terminal)
Ejemplos: `ir jalon`, `agarre supino`, `carga 45`, `tempo 3-1-1-0`, `fase siguiente`, `error encogimiento`, `angulos`, `vista sagital`, `altura 178`, `ayuda`. Un **registro de comandos** único llama a las mismas acciones del *store* que los botones.

### 4.9 Estructura del repositorio
```
mygym/
  docs/
    PLAN.md
    stations/<id>.md        ← contenido biomecánico revisable por estación
    muscles-matrix.md       ← matriz músculos × estaciones (cobertura)
  src/
    app/                    ← rutas (hub, estación), layout
    engine/
      rig/                  ← esqueleto, antropometría, articulaciones, ROM
      kinematics/           ← FK, IK 2 huesos, columna/pelvis, ritmo escapulohumeral, medición
      drivers/              ← Cable, Pivot, Rail, FreeWeight, Bodyweight
      motion/               ← fases, tempo, interpolación, inyección de errores
      biomech/              ← ventanas, evaluación, momentos estimados
      load/                 ← pila, discos, peso corporal, mancuernas
    kit/                    ← piezas paramétricas: tubo, tapizado, pila, discos, polea+cable, agarres, barra, mancuerna, banco
    stations/<id>/          ← machine.ts · variants.ts · content.ts · <id>.test.ts
    ui/                     ← paneles, consola, indicadores, mapa corporal, línea de tiempo
    state/                  ← store (zustand), registro de comandos, sincronización con la URL
    content/                ← catálogo muscular, glosario articular (es)
  tests/e2e/
```

### 4.10 Esquema de datos (borrador)
```ts
type Side = 'L' | 'R';
type JointId = 'pelvis' | 'lumbar' | 'thoracic' | 'cervical'
  | `scapula_${Side}` | `shoulder_${Side}` | `elbow_${Side}` | `forearm_${Side}` | `wrist_${Side}`
  | `hip_${Side}` | `knee_${Side}` | `ankle_${Side}`;
type Dof = 'flexExt' | 'abdAdd' | 'horizAbdAdd' | 'rotIntExt' | 'elevDep' | 'protRet' | 'upDownRot' | 'pronSup' | 'tilt';
type Confidence = 'evidencia' | 'consenso' | 'practica';

interface JointWindow { joint: JointId; dof: Dof; phase: PhaseId | 'all'; min: number; max: number;
  severity: 'aviso' | 'riesgo'; cue: string; source?: string; confidence: Confidence }
interface ErrorSpec { id: string; label: string; description: string;
  offsets: Partial<Record<JointId, Partial<Record<Dof, number>>>>; releaseConstraints?: string[];
  expectedAlerts: Array<{ joint: JointId; dof: Dof }> }
interface Variant { id: string; stationId: string; name: string;
  params: Record<string, number | string>;           // ancho de agarre, orientación, inclinación de tronco, posición de pies…
  keyposes: Record<PhaseId, PartialPose>;             // solo tronco/escápula/cabeza, el resto lo hace la IK
  tempo: [number, number, number, number]; windows: JointWindow[]; errors: ErrorSpec[];
  muscles: Record<PhaseId, MuscleActivation[]>; setup: SetupRule[]; sources: Source[] }
interface MachineSpec { id: string; parts: KitPart[]; driver: DriverSpec; contacts: Contact[];
  adjustments: Adjustment[]; load: StackLoad | PlateLoad | BodyweightLoad | DumbbellLoad }
```

---

## 5. Las 12 estaciones (alcance de contenido)

> Qué significa "al detalle": cada estación cumple la **misma definición de terminado** (sección 6). Las ventanas numéricas definitivas salen de la fase F0 y se validan antes de programarlas.

| # | Estación | Modalidades / agarres | Carga | Articulaciones clave | Errores demostrables (mín. 3) |
|---|---|---|---|---|---|
| 1 | **Fondos** (una estación: libre / asistida con contrapeso / lastrada) | Pectoral (tronco inclinado, agarre algo más ancho, codos algo abiertos) · Tríceps (tronco vertical, agarre estrecho, codos pegados) | Peso corporal ± lastre o asistencia | Hombro (extensión al final del descenso), escápula (depresión), codo, muñeca neutra | Bajar demasiado (hombro en extensión extrema), encoger hombros, codos abiertos en modo tríceps, balanceo |
| 2 | **Prensa de pierna (45°, carril con discos)** | Pies altos/bajos, anchos/estrechos, rotación de pies, unilateral, *gemelo en prensa* | Discos o pila | Rodilla (flexión y alineación frontal), cadera (flexión hasta el inicio de la retroversión), **pelvis/lumbar**, tobillo | Retroversión pélvica abajo (*butt wink*), valgo de rodilla, bloqueo/hiperextensión de rodilla, talones despegados |
| 3 | **Press militar (máquina)** | Agarre prono / neutro · ancho medio o estrecho | Pila | Hombro (elevación en plano escapular), escápula (rotación superior), codo bajo la muñeca, lumbar apoyada | Hiperextensión lumbar, codos por detrás del plano, encoger hombros, rango inferior incompleto |
| 4 | **Press libre con barra (banca plana)** | Agarre medio (≤1,5× biacromial) · cerrado (tríceps) · ancho. **Sin banco inclinado** (decisión) | Barra + discos | Escápula (retracción + depresión), hombro (abducción ≈45–70°), antebrazo vertical, muñeca apilada, trayectoria en J | Codos a 90° del tronco, muñeca en extensión, rebote en el pecho, glúteos despegados, barra hacia el cuello |
| 5 | **Jalón al pecho** | Prono ancho · supino estrecho · neutro (V) | Pila (cable) | Escápula (depresión primero), hombro (aducción/extensión), codo, tronco ligeramente inclinado, cuello neutro | Balanceo de tronco, encoger hombros, tirar con los brazos sin escápula, jalón tras nuca (se muestra como opción no recomendada por defecto) |
| 6 | **Poleas (bíceps / tríceps)** | Curl (barra recta, EZ, cuerda martillo) · extensión de tríceps en polea alta (barra, cuerda, V) · tríceps sobre la cabeza (cuerda) · altura de polea | Pila (cable) | Codo como único motor, hombro estable, muñeca neutra, tronco estable | Codos que avanzan (flexión de hombro), balanceo, muñecas flexionadas, rango incompleto |
| 7 | **Barra de dominadas** | Prona ancha · supina (*chin-up*) · neutra · asistida / lastrada | Peso corporal ± | Escápula (depresión desde colgado activo), hombro, codo, tronco, cuello | *Kipping*, rango parcial, encoger hombros, hiperextender el cuello para "llegar" |
| 8 | **Remo en T** | Con apoyo de pecho / libre (bisagra) · neutro estrecho / prono ancho | Discos (palanca anclada) | **Columna neutra**, cadera (bisagra), rodillas semiflexionadas, escápula (retracción), codos | Flexión lumbar, tirar con extensión de cadera (inercia), encoger hombros, cuello en hiperextensión |
| 9 | **Abductores / aductores** | Abducción · aducción · respaldo vertical o inclinado · rango inicial ajustable | Pila (pivote) | Cadera en plano frontal, pelvis estable, lumbar apoyada | Rango inicial excesivo (aductores en estiramiento máximo con carga), golpear las placas o rebotar, bascular la pelvis |
| 10 | **Peck-deck** | Aperturas (pectoral) · pájaro invertido (deltoides posterior) · brazo extendido / codo en almohadilla | Pila (pivote) | Hombro (aducción/abducción horizontal), codo semiflexionado fijo, escápula contra el respaldo, altura del asiento | Abducción horizontal excesiva por detrás del cuerpo, hombros adelantados, asiento mal regulado |
| 11 | **Press inclinado de pecho (máquina)** | Agarre prono / neutro · ancho medio o estrecho | Pila (pivote convergente) | Hombro (flexión ~30–45° respecto al tronco + abducción moderada), escápula (retracción + depresión), codo bajo la muñeca, lumbar apoyada | Codos a 90° del tronco, hombros adelantados (protracción en el bloqueo), arco lumbar excesivo, asiento mal regulado (manos por encima de los hombros) |
| 12 | **Rack de mancuernas (estación variable)** | Catálogo inicial cerrado: curl, press de hombro sentado, elevaciones laterales, remo unilateral, press inclinado, peso muerto rumano, sentadilla *goblet* · banco regulable | Pares de 2–50 kg | Según el ejercicio | ≥3 por ejercicio |

**Cobertura muscular:** pectoral (1, 4, 10, 11 — 11 con énfasis en porción clavicular), deltoides anterior (3, 4), lateral (3, 12), posterior (10-inv, 8 prono), dorsal (5, 7, 8), trapecio medio/romboides (8, 10-inv), bíceps (6, 7 supino, 12), tríceps (1-T, 4 cerrado, 6), cuádriceps/glúteo (2, 12), **isquios (12: peso muerto rumano; es el grupo más débil, se cubre en el rack)**, abductores/aductores (9), gemelos (2: modalidad de gemelo), core (estabilizador en todas). Se entregará como matriz en `docs/muscles-matrix.md`.

---

## 6. Definición de terminado de una estación (igual para las 12)

- [ ] Máquina construida con el *kit*, con ajustes funcionales (asiento, rodillo, polea, pasador de rango)
- [ ] ≥2 modalidades que **cambian la cinemática y el mapa muscular**
- [ ] Control de carga con representación correcta y carga nominal/efectiva
- [ ] Guion de ≥4 fases con *cues* por articulación, tempo y respiración
- [ ] Ventanas en todas las articulaciones clave, con indicadores en vivo
- [ ] ≥3 errores demostrables, cada uno con su alerta
- [ ] Checklist de ajuste personalizado por antropometría
- [ ] Mapa muscular por variante y fase
- [ ] Fuentes y nivel de confianza en cada regla
- [ ] **Tests**: (a) la IK alcanza los contactos de P5 a P95; (b) el modo ideal queda dentro de las ventanas; (c) cada error dispara exactamente las alertas esperadas
- [ ] Comandos de consola disponibles y estado reflejado en la URL

---

## 7. Fases de ejecución

| Fase | Contenido | Entregable | Puerta de validación |
|---|---|---|---|
| **F0 · Contenido biomecánico** (en paralelo con F1–F2) | Por estación: variantes, fases, ventanas, *cues*, errores, músculos, ajuste y fuentes, más la matriz de cobertura | `docs/stations/*.md`, `docs/muscles-matrix.md` | ✅ **Revisas y validas el contenido** antes de codificarlo |
| **F1 · Cimientos** | Proyecto Vite+TS+React+R3F, cámara isométrica, suelo y zonas del hub vacías, *design tokens*, *kit* de piezas base, *store*, consola mínima, CI (lint, tipos, tests, build) y despliegue en Pages | App desplegada con hub vacío navegable | — |
| **F2 · Motor biomecánico** | Avatar, antropometría, articulaciones/ROM, FK/IK, escápula, pelvis/columna, medición, ventanas, fases/tempo, inyección de errores, momentos, controladores Cable y Rail | Motor con tests unitarios y banco de pruebas visual | — |
| **F3 · Rebanada vertical** | **Jalón al pecho** (cable, tren superior, escápula) + **Prensa de pierna** (carril, tren inferior, lumbar) al 100% de la definición de terminado | 2 estaciones completas | ✅ **Validas nivel de detalle, estilo y mecánicas.** Después se congela el esquema |
| **F4 · Resto de estaciones** (en lotes) | 4a Empuje: fondos, press militar, banca, peck-deck, press inclinado · 4b Tracción/brazos: dominadas, remo T, poleas · 4c Pierna: abd/add · 4d Rack de mancuernas | 10 estaciones | Revisión al final de cada lote |
| **F5 · Hub y experiencia** | Navegación y transiciones, filtro por músculo, consola completa con autocompletado, URLs, persistencia, móvil, accesibilidad, rendimiento (carga diferida de estaciones) | App completa | — |
| **F6 · QA y revisión final** | Tests de propiedades en todas las variantes y percentiles, humo E2E con capturas por estación, revisión de textos y fuentes, aviso legal | Versión 1.0 | ✅ Aprobación final |

Fuera del alcance de la v1 (posibles fases futuras): cuentas o backend, registro de entrenamientos, rutinas encadenadas, **modo cámara con MediaPipe** que compare tus ángulos reales con el guion usando las mismas ventanas, y audio con *cues* por voz.

---

## 8. Revisión del plan (autocrítica y correcciones aplicadas)

Revisé un primer borrador y cambié lo siguiente:

1. **Isométrico 2D con sprites → 3D ortográfico.** Con sprites cada variante × agarre × antropometría necesitaría su propia animación dibujada, y además no se podrían mostrar ángulos reales desde varios planos.
2. **La vista isométrica deforma los ángulos.** En una proyección a 45° un ángulo de rodilla de 90° no se ve como 90°. Por eso: hub en isométrica, vistas anatómicas ortográficas (sagital/frontal/superior) dentro de la estación, y ángulos **calculados siempre en 3D**.
3. **Hacer las 12 estaciones a la vez generaba incoherencia.** Ahora hay una rebanada vertical con dos estaciones de familias opuestas, se congela el esquema y luego se escala. Además, las 5 familias de controladores garantizan que todas las estaciones usen la misma mecánica.
4. **Faltaba la escápula.** Casi todos los *cues* del tren superior son escapulares (deprimir, retraer, no encoger), así que se añadieron los grados de libertad escapulares y el ritmo escapulohumeral. Igual con la **pelvis**, imprescindible para el *butt wink* o el remo.
5. **Un avatar único implica un único "ideal" falso.** El ajuste correcto depende de las palancas de cada cuerpo, así que hay antropometría de P5 a P95 y tests en todo ese rango.
6. **La exactitud del contenido estaba implícita.** Ahora hay una fase de contenido con fuentes, nivel de confianza y validación. Hay que evitar reglas absolutas donde la evidencia es mixta: en el jalón, el efecto del ancho de agarre es **inconsistente** en la literatura; en fondos, los umbrales de riesgo concretos (p. ej. "45°") **no están bien respaldados**. Se presentan como *consenso* o *práctica*, no como ley.
7. **"Peso" podía entenderse como simulación física.** Ahora está definido qué cambia con la carga (visual, carga efectiva, demanda articular estimada, %1RM) y qué no.
8. **El rack de mancuernas no tenía límite.** El catálogo inicial queda cerrado en 7 ejercicios, ampliable con el mismo esquema.
9. **¿Cómo se prueba que la técnica está bien?** Con tests de propiedades: lo ideal cae dentro de las ventanas y cada error inyectado dispara justo sus alertas, lo que da regresión automática del contenido.
10. **La accesibilidad dependía solo del color** (verde/rojo). Ahora siempre va con icono y texto.
11. **El peso corporal funciona al revés.** En fondos y dominadas el cuerpo se mueve respecto a agarres fijos, así que se diseñó como controlador propio (IK desde las manos) en lugar de forzarlo en otro.
12. **Aviso de salud**: contenido educativo, no sustituye a un profesional y hay que adaptarlo a lesiones previas.

---

## 9. Decisiones tomadas (respuestas del usuario)

1. **Estación 11** = **press inclinado de pecho en máquina**. La prensa de pierna es la de 45° con carril y discos.
2. **Fondos**: una estación con modo libre / asistido (contrapeso) / lastrado.
3. **Press libre con barra** = **press de banca plano**. Sin variante inclinada.
4. **Formato**: (A) app web con consola integrada y tema terminal opcional.
5. **Validación del contenido**: la hace el usuario.
6. **Dispositivos**: escritorio y móvil por igual.
7. **Animaciones con Remotion** (Player embebido + `@remotion/three`; exportación a vídeo como extra).

## 10. Fuentes de referencia (para F0)

- NSCA, *Essentials of Strength Training and Conditioning* (técnica y *cues* de consenso)
- AAOS / Soucie et al. 2011 (ROM normativo) · Winter, *Biomechanics and Motor Control of Human Movement* (cocientes de segmentos)
- Wu et al. 2002/2005, recomendaciones ISB de sistemas de coordenadas articulares
- Inman 1944, ritmo escapulohumeral
- Green & Comfort 2007, ancho de agarre en press banca y riesgo de lesión
- Escamilla et al. 2001, *Med Sci Sports Exerc*, biomecánica de rodilla en sentadilla y prensa: https://pubmed.ncbi.nlm.nih.gov/11528346/
- Fondos en banco, barra y anillas (cinemática + EMG): https://pmc.ncbi.nlm.nih.gov/articles/PMC9603242/
- Ancho y orientación del agarre en el jalón (EMG): https://sci-sport.com/en/does-grip-width-influence-muscle-activity-during-lat-pull-down-106/
- Proyectos: Muscle & Motion https://apps.apple.com/us/app/id1302056349 · MuscleWiki https://apps.apple.com/us/app/-/id1096827640 · react-body-highlighter https://github.com/giavinh79/react-body-highlighter · FormCheck https://github.com/ctsc/FormCheck · wger/datasets https://github.com/exercemus/exercises · three-ik https://github.com/jsantell/THREE.IK · mundo isométrico three.js https://discourse.threejs.org/t/small-isometrict-world-with-a-playable-character/60811
