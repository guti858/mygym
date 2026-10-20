# Acta del consejo de decisión · interfaz single-view

**Encargo:** que la vista de estación (y el gimnasio) quepan en una sola pantalla sin scroll en ningún módulo, agrupando lo redundante: Guion + Demostrar un error + Articulaciones, el menú Vista dentro de la escena, la caja de «diálogo en tiempo real» bajo la máquina (duplica el guion dinámico)…

**Sillas del consejo:** UX y accesibilidad (**A**) · Diseño visual y sistema de diseño (**D**) · Entrenador / docente de biomecánica (**E**) · Ingeniería front-end (**I**). Preside y desempata: quien implementa.

**Leyenda:** ✔ a favor · ✖ en contra · ≈ a favor con matices · — no se pronuncia.

## Diagnóstico de partida (1440×900)

| Pieza | Contenido / visible | Problema |
|---|---|---|
| Página | 1027 / 900 px | el pie de página obliga a desplazar |
| Columna de ajustes | 1185 / 816 px | «Vista» queda fuera de pantalla |
| Pestaña Guion (con error) | 1030 / 777 px | scroll |
| Pestaña Articulaciones | 1178 / 777 px | scroll |
| Gimnasio | 1506 / 900 px | las 12 tarjetas, bajo el pliegue |

**Redundancias:**
- El error demostrado aparece en 4 sitios: selector, chip del título, banner en la escena y bloque del guion.
- La pauta actual aparece en 3: caja de la escena, «Ahora» y guion completo.
- Los ángulos aparecen en 3: leyenda en la escena, pestaña e insignia.
- La variante aparece en 3 y la carga en 2.
- El perfil corporal tiene 2 puntos de edición.

## Decisiones

| # | Decisión | A | D | E | I | Resultado |
|---|---|---|---|---|---|---|
| 1 | La app ocupa `100dvh`, sin pie de página ni scroll de página | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| 2 | En la app, la escena no muestra la caja de pauta («diálogo en tiempo real»); el vídeo exportado y la pantalla completa la conservan | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| 3 | El menú Vista pasa a una barra flotante en la escena, en la franja que deja la caja: vistas · ↺ ↻ ⤒ ⤓ · − + · Capas · ⛶ | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| 4 | Las casillas Músculos / Ángulos / Rótulos pasan a un desplegable «Capas» | ✔ | ✔ | ✔ | — | **Aprobada** |
| 5 | Guion, Demostrar un error y Articulaciones se fusionan en una pestaña | ✔ | ✔ | ✔ | ✔ | **Aprobada**; nombre: «Técnica» (A, E, I) frente a «Guion» (D) → **Técnica** |
| 6 | «Ahora» y «Guion completo» se convierten en un carril de 5 fases: la actual desplegada, el resto en una línea, clic = saltar | ≈ | ✔ | ✔ | ✔ | **Aprobada** (A proponía un diálogo aparte; el carril lo hace innecesario) |
| 7 | La tarjeta del error (qué se ve · por qué importa) va bajo los chips, en un hueco fijo; desaparece el bloque rojo | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| 8 | El error dice cuándo se manifiesta («se ve en la contracción») y ofrece «Ir al momento» | — | — | ✔ | — | **Aprobada** por la presidencia: evita mirar el error en una fase donde no se evalúa |
| 9 | Si hay error pero no se evalúa en esta fase, la píldora de la escena no dice «En rango» | — | — | ✔ | — | **Aprobada** |
| 10 | Articulaciones en filas compactas numeradas como las insignias de la escena; la leyenda de la escena se retira en la app | ✔ | ✔ | ✖ | ≈ | **Aprobada** 3-1: E quería conservar la leyenda; las insignias y la píldora siguen en la escena |
| 11 | La pauta correctora (`cue`) y el «por qué» (`why`) van en un hueco fijo bajo las filas: la fila elegida o, si no hay ninguna, la peor | ✔ | — | ✔ | ✔ | **Aprobada** (sin expandir filas: nada se mueve al cambiar de fase) |
| 12 | Demanda articular (N·m): conmutador «Ángulos \| N·m» sobre las mismas filas | ✔ | ✔ | ✖ | — | **Aprobada** 2-1: E la quería en Músculos; el conmutador ahorra alto y la deja a la vista |
| 13 | Se eliminan los chips del título (variante, carga, error) | ✔ | ✔ | ✔ | — | **Aprobada** |
| 14 | Se elimina la insignia «!» de la pestaña | ✖ | ✔ | — | — | **Aprobada** por la presidencia: la píldora de la escena, siempre visible, es el indicador que manda |
| 15 | Variantes en pastillas de 2 columnas, solo con el nombre; debajo, la descripción de la elegida | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| 16 | Carga en una fila; tempo y reps en una fila con «↺ recomendado» | ✔ | ✔ | ≈ | ✔ | **Aprobada** (E prefería el tempo en la línea de tiempo) |
| 17 | El ajuste de la máquina sigue en su pestaña, con las claves de la estación | ✔ | ✔ | ✖ | ✔ | **Aprobada** 3-1: E lo quería en la columna izquierda; no cabe a 1280×720 |
| 18 | Fuentes, nivel de confianza, descargo y créditos se agrupan en «ⓘ Fuentes y avisos» (diálogo junto al título); una línea de descargo queda visible en Ajustes | ≈ | ≈ | ✔ | ≈ | **Aprobada** como síntesis (D: pestaña propia; A: desplegable; I: en Máquina) |
| 19 | Un único sitio para editar el perfil (⌖ de la barra); en Máquina, solo un recordatorio «calculado para 175 cm · cambiar» | — | ✔ | ✔ | — | **Aprobada** |
| 20 | La línea de tiempo queda en controles + pista, sin leyenda (los puntos de color del carril de fases la sustituyen) ni pista de ayuda; zona táctil de 24 px o más | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| 21 | La escena se mantiene en 4:3 y se ajusta al alto disponible (container queries); el aspecto dinámico se aplaza | — | ✔ | — | ✔ | **Aprobada** (I: el vídeo exportado sigue siendo igual que la app) |
| 22 | Pestañas ARIA completas (`aria-controls`, flechas ← →) | ✔ | — | — | — | **Aprobada** |
| 23 | Móvil: escena fija + línea de tiempo + panel con pestañas Ajustes \| **Técnica** \| Músculos \| Máquina; la página no se desplaza y solo el panel puede hacerlo si no cabe | ✔ | ≈ | ≈ | ✔ | **Aprobada** (I: el «sin scroll» estricto no es viable con 7 variantes en móvil) |
| 24 | Gimnasio: plano a la izquierda; a la derecha, intro corta + índice de estaciones por zona + vista previa + filtro por músculo compacto | ≈ | ✔ | — | — | **Aprobada** (A proponía filtro con desplegable; se mantiene el mapa, más pequeño, por ser lo más descubrible) |
| 25 | Unificar tokens entre `palette.ts` y CSS | — | ✔ | — | — | **Aplazada**: no afecta a la maquetación |

## Líneas rojas acordadas

- Nada de `overflow: hidden` para «hacer caber» las cosas. Las regiones mantienen `overflow: auto` como red de seguridad: con zoom al 200 % se debe poder desplazar, nunca recortar.
- El error siempre se ve en la propia escena (banner) y nunca aparece sin su corrección.
- Los botones ↺ ↻ ⤒ ⤓ quedan visibles como alternativa al arrastre (WCAG 2.5.7).
- El vídeo exportado no cambia.
- El descargo educativo no desaparece.
- Nada se mueve al cambiar de fase: los huecos de altura variable se reservan.
- Sin `aria-live` sobre lo que cambia en cada fotograma.

## Mapa final (escritorio)

```
┌ MYGYM  Gimnasio / Jalón al pecho                           ⌖ 175 cm  ◐◑◒◓  >_ Consola ┐
├──────────────┬───────────────────────────────────────────┬──────────────────────────────┤
│ AJUSTES      │ JALÓN AL PECHO · tirón vertical…    ⓘ     │ Técnica | Músculos | Máquina │
│ Agarre       │ ┌───────────────────────────────────────┐ │ ✔ Ideal ✖ Balanceo ✖ Hombros │
│ [Prono][Sup] │ │✖ Hombros encogidos         ✔ En rango │ │ ▌Qué se ve · por qué importa │
│ [Neutro]     │ │                                       │ │  Se ve en: contracción [Ir]  │
│ descripción  │ │          ESCENA 4:3   ③⑤②①④           │ │ FASES                        │
│ Carga −40kg+ │ │                                       │ │ ● Preparación  Ajusta…       │
│ ━━━━●━━━━━   │ │[Iso|Lat|Post|Sup] ↺↻⤒⤓ −+ Capas ⛶    │ │ ● Concéntrica  1. … 2. …     │
│ Tempo 3 1 1 1│ └───────────────────────────────────────┘ │ ARTICULACIONES  Ángulos|N·m  │
│ reps 3  ↺    │ ⏮ ▶ ⏭ ● Concéntrica rep 2/3   ×1  6,4/20 │ ① Tronco ▕▬▬▏ −6° ✔ …        │
│ descargo ⓘ   │ ▕▓▓░▓▓▓░░▓▓▓░▓▓▓▓░░▓▓▓░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▏ │ ▌Corrige: … · Por qué: …     │
└──────────────┴───────────────────────────────────────────┴──────────────────────────────┘
```

## Ajustes durante la implementación

Al medir el peor caso (5 errores, textos de hasta 111 caracteres y 9 ventanas articulares) hubo que concretar varias decisiones:

- **D6.** El carril de fases es horizontal: una línea de 5 pastillas con las mismas abreviaturas y colores que el tempo y la pista. Debajo van las pautas de la fase en curso. En vertical no cabía a 1280×720.
- **D7 y D11.** La pauta y el «por qué» de cada articulación se abren en una tarjeta flotante sobre la lista, al pulsar la fila. Reservar su hueco costaba unos 150 px. La corrección del error (`cue` de la primera ventana afectada) pasa a la tarjeta del error, así que el error nunca se muestra sin ella (línea roja de E).
- **D21.** Ancho y alto se reparten con container queries. Con paneles bajos (menos de 680 px), el modo compacto densifica todo y el guion muestra solo la pauta activa, con el alto reservado para la más larga.
- **D23.** Entre 700 y 1099 px de ancho (tableta, o el panel lateral de un visor) la estación usa 2 columnas, escena y pestañas, en lugar de apilarse.
- **D24.** El índice de estaciones va encima del plano, como barra de navegación por zonas, con la vista previa dentro. A la derecha quedan la presentación y el filtro. El filtro suma un selector nativo, la alternativa en lista que A pedía. El mapa se oculta si la columna mide menos de 600 px.

**Límite conocido:** a 1366×650 (650 px de alto, por debajo del objetivo), en algunos casos con error activo el panel Técnica se desplaza entre 10 y 60 px. Las regiones conservan `overflow: auto` como red de seguridad.

## Verificación

`tests/e2e/app.spec.ts` incluye un test de cero scroll. A 1440×900 y a 1280×720 mide que ni la página ni ningún módulo marcado con `data-fit` tengan `scrollHeight > clientHeight`. Recorre las 12 estaciones, cada una con un error activo y en cada pestaña, y también el gimnasio.
