# Acta del consejo de decisión · módulo del gimnasio isométrico (escenario, navegación y zoom)

**Encargo (solo lectura):** reevaluar el módulo de visualización del gimnasio a todos los niveles: decoración del escenario, ventanas, espejos, logotipo «MYGYM» (manteniendo el estilo global), distribución de áreas, menú de visualización más allá del giro, y el zoom que se ve al pulsar una máquina. Además, dejar la hoja de ruta lista para crear el escenario final con **Blender en local (MacBook Air M3)**.

**Alcance y método.** Se ha leído el código (`HubView`, `HubComposition`, `zoomTransition`, `useSmoothCamera`, `camera.ts`, `GymRoom`, `BakedRoom`, `roomMaterials`, `build_rooms.py`, `layout.json`, `catalog.ts`, `ViewBar`, `StationView`, `styles.css`) y los documentos `ENTORNO_3D.md` y `UX_CONSEJO.md`. **No se ha ejecutado la app ni se han hecho capturas**: lo que sigue sale del código y de las cifras del repositorio. Las apreciaciones puramente visuales (equilibrio de color, «se ve vacío») hay que contrastarlas mirando la app; van marcadas como *(a verificar)*. No se ha modificado ningún fichero salvo este documento.

**Sillas del consejo** (voces simuladas por quien redacta, con el mismo formato que `UX_CONSEJO.md`): UX y accesibilidad (**A**) · Dirección de arte y sistema de diseño (**D**) · Entrenador / docente (**E**) · Ingeniería front-end 3D (**I**) · Artista 3D / Blender (**B**). Preside y desempata quien implementa.

**Leyenda:** ✔ a favor · ✖ en contra · ≈ con matices · — no se pronuncia.

---

## 1. Diagnóstico de partida

### 1.1 Lo que ya funciona (se conserva)

- Pipeline coherente: planta única (`layout.ts` → `layout.json`) → Blender → glTF con luz horneada → materiales teñidos por tema. Un solo origen de verdad.
- Cámara ortográfica con encuadre automático, giro en cuartos con amortiguado, arrastre con ajuste al cuarto más cercano, botones ↺ ↻ como alternativa (WCAG 2.5.7).
- Paredes que se desvanecen según el azimut (corte de maqueta) y rótulos de zona sin solapes.
- Las dos vistas siguen montadas (cero recreación de contextos WebGL); `prefers-reduced-motion` respetado.
- La estación entra «mirando desde el mismo lado» que el plano: la idea de continuidad es buena.

### 1.2 Hallazgos (con evidencia)

| # | Hallazgo | Dónde | Gravedad |
|---|---|---|---|
| H1 | **El gimnasio no tiene zoom ni desplazamiento.** `zoom: 1` está fijado en las props del plano; la elevación es constante (35,264°). La única navegación es el giro en 4 cuartos. Las 12 máquinas caben todas «de lejos» y se ven pequeñas (el encuadre mete 19 × 13 m en la pantalla). | `HubView.tsx` (`zoom: 1`), `HubComposition.tsx` (`elevation: 35.264`) | Alta |
| H2 | **El «zoom» al pulsar una máquina es una copia 2D.** Se clona el `<canvas>` a un lienzo y se escala ×2,4 con `transform`; el plano se renderiza con `dpr={1}`, así que al ampliar se ve **pixelado/borroso**, sobre todo en pantalla Retina (el M3 es dpr 2) *(a verificar)*. Luego se funde con una estación que es **otra sala** (5,6 m, otra decoración): hay un salto de contexto, no un acercamiento. | `zoomTransition.ts`, `HubComposition` (`dpr={1}`) | Alta |
| H3 | **Un clic abre la estación directamente**, sin vista previa. En táctil no hay «hover», así que la vista previa del índice (modalidades y músculos) nunca aparece; el primer toque ya navega. Riesgo de aperturas accidentales y falta de información previa. | `HubView.tsx` (`onSelect`, `onHover`) | Media-alta |
| H4 | **Zona de clic genérica:** una caja de 2,4 × 2,4 × 2,4 m para todas las máquinas. La prensa mide 3 m de largo, las dominadas 2,7 m de alto, el press de banca 2,5 m de ancho: en unas sobra área muerta y en otras queda parte de la máquina sin respuesta. Los datos reales (`half`, `height` por estación) ya están en `layout.json`. | `HubComposition.tsx` (`boxGeometry [2.4,2.4,2.4]`) | Media |
| H5 | **El logotipo no se ve en la vista por defecto.** En el gimnasio solo existe el rótulo de la pared de entrada (`zp`), de 0,38 m de letra y **sin subtítulo** (`sub=None`). Con las 4 orientaciones solo se levantan 2 paredes cada vez; `zp` aparece en los giros 2 y 3, no en el 0 (el de arranque). En el giro 0 se ven ventanales y espejos, pero ninguna marca. | `build_rooms.py` (`sign(w, -2.25, 2.45, 0.38, sub=None)`), `roomMaterials.wallOpacity` | Alta |
| H6 | **Solo 2 de las 4 paredes son visibles cada vez** (giro 0: `xp`+`zn`; 1: `xn`+`zn`; 2: `xn`+`zp`; 3: `xp`+`zp`). El contenido está repartido sin pensar en esta rotación: la fachada de entrada (puerta, taquillas, fuente, TV, rótulo) solo se ve en 2 de 4 giros; los ventanales grandes `xp` en 2 de 4. Cada giro debería tener una «postal» propia. | `build_hub()` | Media |
| H7 | **Vidrio plano.** La ranura `window` es un `MeshBasicMaterial` de un solo color por tema: sin degradado de cielo, sin horizonte, sin elementos exteriores, sin cortinas/estores. Es el elemento que más «abarata» el escenario porque ocupa mucha superficie en el fondo. | `BakedRoom.roomMaterial`, `palette.room.window` | Media-alta |
| H8 | **Espejos = un degradado con 2 franjas diagonales** (textura de lienzo de 256 × 512), igual en todos, sin reflejo de nada; en el gimnasio son 10 lunas iguales en `zn`. Se leen como pantallas grises. El código ya lo reconoce («un reflejo real costaría otro render»). | `GymRoom.mirrorTexture`, `build_rooms.mirror` | Media |
| H9 | **Reparto de áreas con mucho aire.** 12 máquinas en 247 m² (≈ 20 m²/máquina). Superficie de zona por máquina: Pierna 26 · Zona libre 22 · Empuje 18 · Tracción 15,5 · Brazos 14,5. El espacio vacío grande (centro-sur de Empuje, fondo de Pierna, Libre) no tiene función ni decoración que lo justifique, y fuerza un encuadre lejano (H1). | `layout.ts`, `layout.json` | Media |
| H10 | **El menú de vista del gimnasio es solo ↺ ↻.** La estación, en cambio, tiene vistas, giro, inclinación, zoom, capas y pantalla completa (`ViewBar`). Paridad rota. No hay «reiniciar vista», ni inclinación, ni capas (rótulos, zonas, filtros), ni velocidad de animación, ni enlace compartible del estado del plano (la estación sí guarda `giro` e `incl` en la URL). | `HubView.tsx` (`hub__rotate`) | Media-alta |
| H11 | **Rótulos siempre visibles a un solo tamaño** (12 de máquina + 5 de zona, 17/15 px × `unit`). Funcionan hoy porque no hay zoom; en cuanto lo haya, necesitan nivel de detalle. | `HubComposition.tsx` | Media (depende de H1) |
| H12 | **Calidad de render del plano:** `dpr={1}` fijo + máquinas a 15 fps. Correcto para rendimiento en equipos modestos, pero en pantallas dpr 2 el plano se ve blando. Con zoom real habrá que subirlo. | `HubComposition.tsx` | Media |
| H13 | **Accesibilidad del plano:** el lienzo es `role="img"` con el índice como alternativa (bien), pero no hay navegación por teclado *dentro del plano* (flechas entre estaciones vecinas), ni foco visible en 3D, ni anuncio del cambio de giro. | `HubView.tsx` | Media |

---

## 2. Decisiones del consejo

### 2.1 Zoom al pulsar una máquina

| # | Decisión | A | D | E | I | B | Resultado |
|---|---|---|---|---|---|---|---|
| Z1 | **Dos tiempos:** *un clic selecciona* (la máquina se destaca, el resto se atenúa, aparece una tarjeta flotante con nombre · músculos principales · modalidades · bucle del movimiento) y *«Abrir estación»* (botón, doble clic, Intro) entra. En táctil: primer toque = seleccionar, segundo = abrir. | ✔ | ✔ | ✔ | ≈ | — | **Aprobada** (I: coste de una tarjeta HTML anclada al 3D; asumible, ya existen rótulos anclados) |
| Z2 | **Acercamiento real dentro de la escena del gimnasio** (cámara ortográfica: `zoom` y objetivo animados hacia la máquina) en lugar de la copia 2D. Mientras se acerca: anillo en el suelo, resto de máquinas al ~35 % y paredes que molestan fuera. | ✔ | ✔ | ✔ | ✔ | ✔ | **Aprobada.** `HubCompProps` ya trae `zoom`; falta `target` y la animación. Resuelve H2 sin pérdida de nitidez |
| Z3 | **Conservar el fundido a la estación**, pero enlazado: el encuadre final del acercamiento debe coincidir con el de entrada de la estación (mismo azimut —ya lo hace—, misma escala en px/m y mismo centro). El «salto» queda reducido a cambiar de sala, con un fundido corto (≤ 250 ms). | — | ✔ | — | ✔ | ✔ | **Aprobada** |
| Z4 | **Mantener la copia 2D solo como respaldo** (si el plano no puede animarse, p. ej. rendimiento muy bajo) y capturarla a dpr 2. | — | ≈ | — | ✔ | — | **Aprobada** como red de seguridad |
| Z5 | **Misma sala en el fundido (a medio plazo):** que la sala de estación sea un *recorte* del gimnasio (misma decoración de la zona a la que pertenece la máquina) y no una sala genérica de 5,6 m. Así el acercamiento es continuo de verdad. | ≈ | ✔ | ✔ | ✖ | ✔ | **Aprobada 3-1-1 como línea de trabajo, no para la primera iteración.** I: obliga a hornear luz por zona y a duplicar geometría; se estudia tras Z1–Z3 |
| Z6 | Con `prefers-reduced-motion`: sin animación de cámara; la tarjeta aparece y «Abrir» entra directamente. | ✔ | — | — | ✔ | — | **Aprobada** |
| Z7 | **Zona de clic por huella real** de cada máquina (caja con `half` y `height` de `layout.json`, +10 cm) en lugar de 2,4 m³ universales; y un objetivo táctil mínimo de 44 px en pantalla. | ✔ | — | — | ✔ | — | **Aprobada** |
| Z8 | Al volver («Gimnasio» en la cabecera): alejar desde la máquina recién visitada, que queda destacada 1,5 s. | ✔ | ✔ | ✔ | ≈ | — | **Aprobada** (I: baja prioridad) |

### 2.2 Menú de visualización extendido

Se propone una **barra de vista del gimnasio** equivalente a la de la estación (misma gramática visual `hud`, mismo desplegable «Capas»):

```
[Iso 1 │ Iso 2 │ Iso 3 │ Iso 4 │ Planta]   ↺ ↻   ⤒ ⤓   − ＋  ⌂   [Capas ▾]  ⛶
```

| # | Decisión | A | D | E | I | B | Resultado |
|---|---|---|---|---|---|---|---|
| M1 | **Vistas predefinidas** nombradas por lo que miran (hoy son «giro 0–3» anónimos): *Ventanales + espejos*, *Espejos + ventanas laterales*, *Entrada + ventanas laterales*, *Entrada + ventanales*, y **Planta** (cenital, 89°, sin paredes). Aportan orientación mental. | ✔ | ✔ | ✔ | ✔ | ✔ | **Aprobada** |
| M2 | **Zoom** con botones −/＋, rueda del ratón (Ctrl/⌘ + rueda para no secuestrar el scroll), pellizco en táctil; rango 1×–3,5×; con zoom > 1 el arrastre pasa de «girar» a «desplazar» y el giro queda en ↺ ↻, teclado y Mayús + arrastre. | ✔ | ✔ | — | ≈ | — | **Aprobada** (I: el conflicto arrastre-giro/arrastre-desplazar es el punto delicado; se resuelve por modo) |
| M3 | **Inclinación** limitada (20°–60° más la planta), con ⤒ ⤓ como en la estación. | ✔ | ≈ | — | ✔ | ✔ | **Aprobada** (D: fuera de 35° la «isometría» deja de ser isométrica; se rotula «ortográfica») |
| M4 | **⌂ Reiniciar vista** (giro 0, zoom 1, sin desplazamiento) y comando de consola equivalente. | ✔ | ✔ | ✔ | ✔ | — | **Aprobada** |
| M5 | **Capas ▾** del gimnasio: rótulos de máquina · nombres de zona · anillos de músculo · reproducir/pausar el movimiento · velocidad (½×, 1×, 2×) · «solo la zona seleccionada» · mini-mapa. | ✔ | ✔ | ✔ | ✔ | — | **Aprobada** |
| M6 | **Buscar / saltar a estación** (campo con autocompletado, atajo `/`): centra y selecciona. Complementa el índice, que ya existe. | ✔ | — | ✔ | ✔ | — | **Aprobada** |
| M7 | **Mini-mapa 2D** (planta esquemática, rectángulo de la vista actual, clic = ir) visible solo si hay zoom > 1. | ✔ | ✔ | — | ≈ | — | **Aprobada** (I: se genera del propio `layout.json`, sin 3D) |
| M8 | **Modo «Recorrido»** guiado: visita zona a zona en un orden docente, con parada de unos segundos y botón *Abrir*. Para quien aún no sabe qué mirar. | ✔ | ✔ | ✔ | ≈ | — | **Aprobada** como fase 2 (I: reutiliza el motor de cámara de Z2) |
| M9 | **Enlace compartible** del plano (giro, zoom, desplazamiento, estación seleccionada), igual que la estación. | ✔ | — | — | ✔ | — | **Aprobada** |
| M10 | **Ambiente** (día · tarde · noche) además de los 3 temas. Natural con ventanas con cielo (H7). | ✔ | ✔ | — | ≈ | ≈ | **Aprobada 3-2** como opcional: I y B avisan de que «noche» con luz horneada diurna es incoherente salvo que se hornee una segunda luz (ver §4.5) |
| M11 | **Teclado en el plano:** `←→↑↓` entre estaciones vecinas (por posición), `Intro` abre, `+ −` zoom, `0` reinicia, `Q E` giran, `Esc` deselecciona, `?` ayuda. Foco visible = anillo + tarjeta. `aria-live="polite"` solo al seleccionar. | ✔ | — | — | ✔ | — | **Aprobada** |
| M12 | **Pantalla completa** del plano (⛶), como en la estación. | ✔ | ✔ | — | ✔ | — | **Aprobada** |

**Rótulos con nivel de detalle** (H11): a zoom ≤ 1,2× → 5 rótulos de zona + máquinas con nombre corto; de 1,2× a 2,2× → rótulo de máquina + músculo principal; a > 2,2× → solo la seleccionada y sus vecinas. **Aprobada** por unanimidad.

**Línea roja heredada** (`UX_CONSEJO.md`): ninguna interacción depende solo del arrastre; todo gesto tiene botón y tecla; nada de `overflow: hidden` para esconder desbordes; la barra no tapa las máquinas del borde (franja reservada, como en `ViewBar`).

### 2.3 Distribución de áreas

| # | Decisión | A | D | E | I | B | Resultado |
|---|---|---|---|---|---|---|---|
| D1 | **Compactar el suelo** de 19 × 13 m a ~16 × 11,5 m (≈ 185 m²) manteniendo pasillos de 1,6–2 m y las huellas actuales, y **ocupar el perímetro** con áreas decorativas no interactivas. Máquinas más cerca = encuadre más grande sin tocar la cámara. | ✔ | ✔ | ≈ | ✔ | ✔ | **Aprobada** (E: mínimo 1,6 m entre huellas para conservar la sensación de espacio de trabajo) |
| D2 | **Orden de recorrido docente** (entrada → fondo): calentamiento/recepción → Empuje → Tracción → Brazos → Pierna → estiramientos junto a los ventanales. Se mantienen las posiciones relativas actuales y se les da sentido: flechas pintadas en el suelo y numeración 1-5 en los rótulos de zona. | ✔ | ✔ | ✔ | — | — | **Aprobada** |
| D3 | **Áreas decorativas** (sin lógica, atrezo horneado): *línea de cardio* (3-4 cintas/bicis simples) contra la pared de fondo del giro 0; *estiramientos/funcional* (esterillas, TRX, caja pliométrica) en el hueco de «Zona libre»; *mostrador de recepción* junto a la puerta; *agua y descanso*. | ✔ | ✔ | ≈ | ✔ | ✔ | **Aprobada** (E: que no se confundan con estaciones: sin anillo ni rótulo interactivo, tono más apagado) |
| D4 | **Suelo por zona con más personalidad:** textura de caucho propia, losetas con microvariación y señalética pintada (pictograma + nombre). El rótulo HTML se mantiene por accesibilidad. | ✔ | ✔ | — | ✔ | ✔ | **Aprobada** |
| D5 | **Ritmo de máquinas:** la fila de press (`z=0.6`) y la de tracción (`z=-4.2`) ya forman filas legibles; `fondos` (z=4.6) y `mancuernas` (6,1; 4,5) forman una tercera fila de solo 2 elementos. Reequilibrar para que se lea como fila. | ≈ | ✔ | ✔ | — | — | **Aprobada** como ajuste menor |
| D6 | **Oclusión:** con los giros 2-3 la fila norte (dominadas 2,7 m, jalón 2,42 m) pasa a ser la delantera y puede tapar la central *(a verificar)*. Si ocurre: atenuarla cuando haya una selección detrás. | ✔ | — | — | ✔ | — | **Aprobada** como comprobación |

### 2.4 Escenario: decoración, ventanas, espejos y logotipo

**Principio de dirección de arte (D):** mantener el sistema actual —fondo oscuro/claro/terminal, acento naranja `#ff7a3d`, *Big Shoulders Display* 900 para la marca e *IBM Plex Mono* para lo secundario, bloque cursor tras «MYGYM» (el `brand__mark` de la cabecera)— y pasar de **«sala neutra con adornos»** a **«gimnasio con identidad»**: materiales honestos (hormigón, madera, acero negro, caucho), un único acento de marca, luz cálida contra paredes frías. Todo color nuevo sale de ranuras del tema.

#### Logotipo «MYGYM»

| # | Decisión | A | D | E | I | B | Resultado |
|---|---|---|---|---|---|---|---|
| L1 | **Logo de suelo** en el pasillo central: lockup *MYGYM + cursor + «GUION ARTICULAR»* pintado (ranura `decal`, ~4,5 m de ancho). Es lo único que se ve **siempre**, gire como gire (H5). | ✔ | ✔ | — | ✔ | ✔ | **Aprobada** |
| L2 | **Monograma «M» + cursor** como emblema circular (sin dirección de lectura) para el centro del plano y para pantallas de carga/ícono: se lee igual en los 4 giros. El lockup horizontal va a las paredes. | ✔ | ✔ | — | ✔ | ✔ | **Aprobada** |
| L3 | **Letrero luminoso de pared** (letras de acero negro con tira LED detrás, ranura `led`) en **las 4 paredes con variantes**: `zn` (espejos) lockup grande sobre los espejos; `xp` (ventanales) monograma; `zp` (entrada) lockup; `xn` monograma pequeño. Cada giro tiene marca visible. | ✔ | ✔ | ✔ | ≈ | ✔ | **Aprobada** (I: cada letrero son cientos de triángulos; sin luz horneada y como pieza propia, cabe en el presupuesto) |
| L4 | **Tamaño mínimo:** altura de letra ≥ 0,9 m en el lockup principal (hoy 0,38 m ≈ 12 px en pantalla *(a verificar)*). Debe leerse a zoom 1× en 1440 × 900. | ✔ | ✔ | — | — | ✔ | **Aprobada** |
| L5 | **Tema terminal:** el letrero usa la fuente mono y el cursor parpadea, solo sin `prefers-reduced-motion`. | ≈ | ✔ | — | ≈ | — | **Aprobada** como pulido opcional (I: requiere invalidar el lienzo) |

#### Ventanas

| # | Decisión | A | D | E | I | B | Resultado |
|---|---|---|---|---|---|---|---|
| V1 | **Exterior detrás del vidrio:** plano a 1,5–3 m con textura de paisaje (horizonte urbano suave / cielo con degradado) *teñida por tema*; vidrio translúcido y marco negro más grueso. Hoy es un color liso (H7). | ✔ | ✔ | — | ✔ | ✔ | **Aprobada** |
| V2 | **Estores enrollables a media altura** (geometría simple): rompen la regularidad y dan sensación de uso. | — | ✔ | — | ✔ | ✔ | **Aprobada** |
| V3 | **Repartir las ventanas por giro:** los ventanales de `xn` (2, más pequeños) se igualan a los de `xp` (3) para que los cuatro giros tengan una «postal luminosa»; la banda alta de `zn` se mantiene. | ✔ | ✔ | — | — | ✔ | **Aprobada** |
| V4 | **Manchas de sol en el suelo:** ya hay una luz solar horneada; colocar los ventanales para que dibujen parches nítidos en el giro 0. Es el recurso de realismo más barato. | — | ✔ | — | — | ✔ | **Aprobada** |

#### Espejos

| # | Decisión | A | D | E | I | B | Resultado |
|---|---|---|---|---|---|---|---|
| E1 | **Reflejo horneado con Cycles (glossy)** de lo *estático* (luminarias, ventanas, estanterías, plantas, letreros) en una textura por pared; sin máquinas ni avatar. Se mezcla con un velo oscuro y el degradado actual para que la ausencia de máquinas no se note. Sustituye a las 2 franjas diagonales (H8). | ✔ | ✔ | — | ✔ | ✔ | **Aprobada** |
| E2 | **Variación entre lunas:** pequeña diferencia de tono y velo, juntas de 2-3 cm, marco de acero negro biselado, alguna luna con suciedad suave. Hoy son 10 idénticas. | — | ✔ | — | — | ✔ | **Aprobada** |
| E3 | **Reflejo vivo del avatar:** descartado por ahora. `Reflector` de three no se integra bien con cámara ortográfica y un segundo render por fotograma contradice el presupuesto de rendimiento. | — | ≈ | — | ✔ | ✖ | **Aplazada** (B querría una silueta con alfa en un plano de profundidad; se estudia después) |
| E4 | **Barra de apoyo / barra baja** frente al espejo principal como atrezo (da escala y función a la pared). | — | ✔ | ✔ | — | ✔ | **Aprobada** |

#### Resto de decoración

- **Techo visto** (ductos y vigas de acero negro, luminarias colgantes): solo lo que se ve desde la isométrica; se oculta con el techo como hoy. ✔ unánime (I: presupuesto controlado).
- **Piezas de «lugar real»** de bajo coste: estantería de toallas, dispensador de gel, papeleras, cartelería de seguridad. ✔ A, D, B.
- **Una pared con panel de madera o ladrillo oscuro por giro** para romper el enlucido liso. ✔ D, B *(a verificar con la paleta clara)*.
- **Mural anatómico** (silueta del mapa muscular como vinilo): identidad de producto reutilizando activos propios. ✔ D, E, B.
- **Presupuesto:** lo nuevo ≤ ~+0,8 MB sobre el glTF compactado (hoy 1,86 MB; en base64 dentro de la app, 2,48 MB).

### 2.5 Estación individual (sala de 5,6 m)

- El rótulo `MYGYM` de la pared `zn` (0,42 m) sube a ≥ 0,7 m, centrado sobre los espejos (fondo de las vistas frontal e isométrica).
- Los ventanales con banco (`xp`) tienen buen papel (fondo de la lateral); aplicar V1/V2.
- Coherencia (Z5): la estación de «Prensa» debería parecerse a la **zona Pierna** del gimnasio (mismo color de línea y suelo), la de «Jalón» a **Tracción**, etc. Hoy es la misma sala para todas. ✔ A, D, E, B; I ≈ (5 horneados de 1024²: ~1,5 min c/u en el contenedor, mucho menos en el M3).

---

## 3. Arquitectura y viabilidad (silla I)

### 3.1 Cambios de código previstos (no ejecutados aquí)

| Área | Cambio | Ficheros | Esfuerzo |
|---|---|---|---|
| Cámara del gimnasio | `HubCompProps` gana `target`, `zoom` y `elevation` animables; `fitCamera` ya admite `zoomFactor`; `useSmoothCamera` se amplía a (azimut, elevación, zoom, x, z) con el mismo amortiguado | `props.ts`, `HubComposition`, `useSmoothCamera`, `camera.ts` | M |
| Selección en dos tiempos + tarjeta | Estado `selected` en el store; tarjeta HTML anclada con `project()`; botón «Abrir» | `HubView`, `store`, nuevo `HubCard` | M |
| Zoom real | Sustituir `zoomInto` por animación de cámara en el propio plano + fundido; mantener `zoomInto` como respaldo (dpr 2) | `zoomTransition.ts`, `HubView` | M |
| Barra de vista del gimnasio | Nuevo `HubViewBar` con los grupos de M1–M12; comparte estilos `hud` | `ui/`, `styles.css` | M |
| Zonas de clic por huella | Leer `half`/`height` de `layout.ts` (la fuente de verdad) | `HubComposition` | S |
| Rótulos con LOD | Nivel según zoom | `HubComposition` | S |
| Mini-mapa | SVG desde `HUB_ZONES` + estaciones | nuevo | S |
| Teclado | Navegación espacial entre estaciones | `HubView` | S |
| URL compartible del plano | Añadir el estado del plano al módulo de URL | `state/` | S |
| Calidad dinámica | `dpr = 1` en movimiento, `min(devicePixelRatio, 2)` en reposo o con zoom > 1,5 | `HubComposition` | S-M |

### 3.2 Riesgos

1. **Arrastre dual (girar/desplazar):** requiere modos claros y prueba táctil. Mitigación: ↺ ↻ y teclado siempre; pellizco = zoom; dos dedos = desplazar.
2. **Rendimiento con zoom y dpr 2:** 12 máquinas con avatar + sala horneada. Mitigación: con una selección, las demás a 7,5 fps o congeladas; solo la seleccionada a 30 fps.
3. **Coherencia gimnasio ↔ estación (Z3/Z5):** el encaje de escala exige una función común de encuadre; conviene un test como `camera.test.ts`.
4. **Contrato glTF:** escenas `station` y `hub`, claves de fundido `xp/xn/zp/zn` en `userData.fade`, materiales `sala/ranura~modo` (`atlas|vertex|none`), segundo juego de UV para el atlas, `lightRange`. `environment.test.ts` lo vigila: **cualquier activo hecho a mano en Blender debe respetarlo**.
5. **Tamaño:** `gym-env.generated.ts` pesa 2,48 MB. Presupuesto propuesto ≤ 3,5 MB; si se supera, cargar `station` bajo demanda.

### 3.3 Niveles de calidad

En Capas: **Alta** (espejos con reflejos, exterior, estores, atrezo completo) · **Media** (sin atrezo menor) · **Baja** (como hoy). Las piezas opcionales viajan en el mismo glTF como nodos con `userData.quality` y la app los oculta; no se cargan mallas aparte. Por defecto, Alta si `devicePixelRatio ≥ 2`, Media en el resto.

---

## 4. Plan para el escenario final con Blender en local (MacBook Air M3)

### 4.1 Qué cambia al pasar del contenedor al M3

`build_rooms.py` se pensó para un contenedor **sin GPU** (Cycles por CPU: atlas del gimnasio 2048² a 64 muestras ≈ 11 min; filtro bilateral propio porque el desruido OIDN no es directo desde `bpy` en segundo plano). En el M3:

| Aspecto | Contenedor (hoy) | MacBook Air M3 |
|---|---|---|
| Motor | Cycles CPU, 4 vCPU | **Cycles con GPU «Metal»** (`cycles.preferences.compute_device_type = 'METAL'`, `scene.cycles.device = 'GPU'`) o CPU de 8 núcleos; ambos mucho más rápidos |
| Atlas del gimnasio | 2048², 64 muestras | 4096² y 256+ muestras viable *(a medir)* |
| Desruido | Filtro bilateral propio | **OIDN** de Blender con la interfaz abierta; se puede sustituir el filtro o comparar ambos |
| Iteración | Todo por script | Script **+ Blender abierto**: revisar el `.blend`, retocar a mano y re-hornear |
| Tipografía | Fuente vectorial básica del script (`part.text`) | Usar *Big Shoulders Display* e *IBM Plex Mono* (ambas OFL) para el rótulo |

> Notas de entorno *(a verificar)*: Blender 5.x en macOS arm64 está soportado. El repo documenta `bpy==5.2.2` (Python 3.13); comprobar que existe rueda para tu Python en Apple Silicon. Alternativa sin `pip`: lanzar la app de Blender instalada en modo `-b -P scripts/environment/build_rooms.py -- <layout.json> <salida>`; el script lee sus argumentos tras `--` (confirmar la cabecera del script).

### 4.2 Flujo de trabajo recomendado (híbrido)

1. **El script sigue siendo la fuente de verdad estructural**: planta, huecos, luminarias, colocación de atrezo con comprobación de colisiones contra las huellas de las máquinas, horneado y exportación. Reproducible y revisable en Git.
2. **Los activos «de autor» van a una biblioteca `.blend`** (p. ej. `scripts/environment/assets.blend`): logotipo en relieve, estores, cintas de cardio, mostrador, mural anatómico, bancos de madera… El script los añade con `bpy.ops.wm.append` y les asigna ranuras de material por nombre.
3. **Archivo de depuración:** el script guarda también un `.blend` para abrir en la interfaz y revisar luz, UV y atlas antes de exportar.
4. **Exportar solo lo que consume la app** y pasar `npm test` (contrato del entorno) antes de integrar.

### 4.3 Encargo de arte (prioridades y presupuesto orientativo)

| Prioridad | Pieza | Notas | Triángulos aprox. |
|---|---|---|---|
| P0 | Lockup «MYGYM» en relieve + cursor + «GUION ARTICULAR», con y sin halo; monograma «M» | Ranuras `decal` / `frame` / `led` | ≤ 4 000 c/u |
| P0 | Decal de suelo (lockup y monograma) | Plano con textura o geometría plana; ranura `decal` | ≤ 500 |
| P0 | Ventanas V1–V4 (vidrio translúcido, marco, estor, exterior) | `window` + `line`; exterior sin luz horneada (`~none`) | ≤ 2 500 por ventanal |
| P0 | Espejos E1–E2 | Textura glossy horneada por pared + juntas y marcos | ≤ 600 por pared |
| P1 | Cardio (cintas ×3, bicis ×2), mostrador, estantería de toallas | Siluetas simplificadas; `metal` / `frame` / `pad` | ≤ 3 000 por pieza |
| P1 | Mural anatómico (vinilo) | Textura plana con el trazado de `bodymap.generated.ts` | 2 |
| P1 | Techo visto (ductos, vigas, luminarias colgantes) | Solo piezas visibles desde arriba | ≤ 6 000 total |
| P2 | Esterillas, TRX, caja pliométrica, balones | Reutilizar atrezo actual | — |
| P2 | Variante «noche» | Ver §4.5 | — |

**Reglas de arte para respetar el contrato con la app:**
- Un material por **ranura** (`sala/ranura` o `sala/ranura~vertex|none`); solo se reconocen las de `roomMaterials.slotColor` (si hace falta una nueva: añadirla ahí y en `SLOTS` del script).
- Todo lo que cuelga de una pared lleva su clave de fundido (`xp|xn|zp|zn`) en el nodo.
- Superficies grandes: segundo juego de UV sin solapes para el atlas; atrezo pequeño: luz por color de vértice.
- Sin texturas ni modelos de terceros con licencia dudosa (hoy todo es procedural; se mantiene la política).
- Ejes de la app (X derecha, Y arriba, Z hacia la cámara frontal); el exportador deshace el cambio de ejes.

### 4.4 Procedimiento de integración

```text
1. npm run env:layout                         # layout.json (si cambia la planta)
2. Blender en el M3 (GPU/Metal): script + assets.blend → .blend de depuración + glTF
3. compact_glb.py                             # compactar (≈ −30 %)
4. npm test                                   # environment.test.ts (contrato)
5. npm run build && npm run e2e               # no regresión, incluido el cero-scroll
6. Capturas por tema (claro / oscuro / terminal) × 4 giros   # revisión visual
```

### 4.5 Ambiente (día / tarde / noche)

La luz es horneada: un cambio de ambiente real exige más de un horneado.

- **A (barata):** solo cambian los colores de las ranuras `window`, `led`, `accent` y el exterior (V1). La luz de la sala no cambia. Vale entre «día» y «tarde»; «noche» queda poco creíble.
- **B (correcta):** hornear **dos atlas** (día y noche, ≈ +2,5 MB) y mezclarlos en el shader. Duplica el peso; el coste de horneado en el M3 es asumible.
- **Recomendación:** A ahora; B solo si «noche» se decide como modo de primera clase.

### 4.6 Tiempos de horneado en el M3 *(a medir)*

Validar primero la composición con `--quick` y luego subir muestras y resolución. Anotar los tiempos reales en `ENTORNO_3D.md`; el script ya imprime el tiempo acumulado por fase.

---

## 5. Hoja de ruta propuesta

| Fase | Contenido | Resultado visible | Depende de |
|---|---|---|---|
| **F1 · Navegación** | Zoom y desplazamiento, ⌂ reiniciar, barra de vista del gimnasio, rótulos con LOD, teclado, zonas de clic por huella | El gimnasio se puede explorar de cerca | — |
| **F2 · Acercamiento** | Selección en dos tiempos + tarjeta, zoom real de cámara, fundido enlazado a la estación, `dpr` dinámico | Pulsar una máquina ya no pixela ni salta | F1 |
| **F3 · Escenario v2 (Blender)** | Logotipo (L1–L4), ventanas (V1–V4), espejos (E1–E2), reparto de paredes por giro | Identidad de marca y fondo creíble | M3; independiente de F1/F2 |
| **F4 · Áreas** | Compactar y decorar el perímetro (D1–D5), cardio / recepción / estiramientos, señalética | Gimnasio con sentido de recorrido | F3 |
| **F5 · Extras** | Recorrido guiado (M8), mini-mapa (M7), ambiente (M10), sala de estación por zona (Z5), reflejo vivo (E3) | Pulido de producto | F2–F4 |

Cada fase se verifica con `npm test`, `npm run e2e` (incluido el cero-scroll) y revisión visual en los tres temas.

---

## 6. Líneas rojas acordadas

- El **estilo global no cambia**: mismos tokens, tipografías, acento naranja y tres temas; todo color nuevo sale de una ranura del tema.
- **Ninguna acción depende solo del arrastre**: botón y tecla para girar, desplazar y hacer zoom.
- **`prefers-reduced-motion`** mantiene todo funcional, sin animaciones de cámara ni parpadeos.
- **El índice de estaciones y su vista previa** (alternativa accesible al 3D) no desaparecen al añadir la tarjeta 3D.
- **El contrato del entorno** (`environment.test.ts`) y el presupuesto de peso se respetan.
- **El vídeo exportado (Remotion) no cambia** salvo que se pida: las novedades de interfaz viven en `app/` y `ui/`.
- Lo marcado *(a verificar)* se confirma con capturas antes de implementar.

## 7. Preguntas abiertas para quien decide

1. ¿**Compactar el suelo** (máquinas más grandes en pantalla) o **conservar 19 × 13 m** y llenar el perímetro? El consejo recomienda ambas en dosis.
2. ¿«Noche» como modo de primera clase (dos horneados) o solo ambiente cromático (opción A)?
3. ¿La **sala de cada estación** hereda la decoración de su zona (Z5) en esta ronda, o se mantiene genérica hasta después de F2?
4. ¿Se acepta subir el techo de peso del entorno de ~2,5 MB a ~3,5 MB?
5. ¿El logotipo se mantiene con *Big Shoulders Display* (la de la cabecera) o se quiere otra tipografía?

---

## 8. Implementación de F1, F2 y F3 y valoración global

Las tres fases se desarrollaron a la vez: el horneado de Blender (F3, ~12 min de CPU en el contenedor)
corría en segundo plano mientras se programaban F1 y F2. Después se revisaron juntas y se fusionaron
con la rama por defecto.

### 8.1 Qué se ha hecho

| Fase | Decisiones | Implementación |
|---|---|---|
| **F1 · Navegación** | M1–M5, M11, M12, LOD de rótulos, Z7 | `src/scene/hubCamera.ts` (cámara pura: zoom bajo el puntero, desplazamiento limitado al suelo, encuadre de una máquina, vecino con flechas, nivel de rótulos) · `src/ui/HubViewBar.tsx` (Iso 1–4 · Planta · ↺ ↻ · ⤒ ⤓ · − + · ⌂ · Capas · ⛶) · gestos en `src/app/HubView.tsx` (arrastre que gira o, con zoom, desplaza; Ctrl/⌘ + rueda; pellizco) · teclado (flechas, Intro, Esc, + −, Q E, 0) · consola (`vista iso1…iso4|planta|inicio`, `girar 90`, `inclinar`, `zoom`) · zona de clic con la caja de cada máquina (`src/stations/hubPlacement.ts`) |
| **F2 · Acercamiento** | Z1, Z2, Z3, Z4, Z6, Z8, dpr dinámico | Clic = elegir (anillo, viñeta, tarjeta con zona, modalidades y músculos, «Abrir estación»); segundo clic, botón o Intro = abrir. La cámara del plano vuela a la máquina con los márgenes de la estación y el plano, ya nítido, se funde (220 ms) con la estación (`crossfadeFrom`; la copia ampliada queda como respaldo). Al volver, el plano se aleja hasta la vista anterior y destaca la máquina 1,5 s. Con «reducir movimiento», todo directo. El lienzo se pinta a la densidad de la pantalla (1×–2×). |
| **F3 · Escenario v2** | L1–L4, V1–V4, E1–E2, H6 | `scripts/environment/build_rooms.py`: logotipo de la cabecera (◢◣ MYGYM guion articular) en relieve con *Big Shoulders Display* e *IBM Plex Mono* (OFL, `scripts/environment/fonts/`): 0,9 m sobre los espejos, sobre la puerta, en el suelo y en la sala de estación (0,7 m); emblema circular en las paredes laterales y en el suelo. Tres ventanales con estores en cada pared lateral, exterior (cielo, edificios, árboles) tras cada hueco y vidrio translúcido. Espejos con reflejo horneado (Cycles, vista de frente), lunas con leve giro y marco de acero. Opción `--gpu` (Metal en el M3). |

Lo que queda fuera de estas fases (F4–F5 del acta): reparto y compactación de áreas, áreas
decorativas de cardio y recepción, recorrido guiado, mini-mapa, ambiente día/noche, sala de estación
por zona y reflejo vivo del avatar. Tampoco va el enlace compartible del plano (M9).

### 8.2 Valoración global: cómo encajan las tres fases

| Cruce | Riesgo | Cómo queda |
|---|---|---|
| F1 × F2 | Un arrastre (giro o desplazamiento) acaba en clic y elige o abre una máquina sin querer | El clic que cierra un arrastre se descarta (umbral de 6 px), igual que antes con el giro. Dos dedos nunca cuentan como clic. La tarjeta y la barra no inician arrastres |
| F1 × F2 | El vuelo a la máquina pisa el zoom y el desplazamiento del usuario | El vuelo es una vista aparte: al volver, la cámara regresa a la vista que había (giro, inclinación, zoom y desplazamiento intactos) |
| F1 × F2 | Teclado del plano frente a teclado global (`:` abre la consola) y foco en la tarjeta | El plano solo atiende teclas cuando el foco está en él (no en sus botones) y sin modificadores; `:` sigue abriendo la consola |
| F2 × F3 | La copia para el fundido necesita el búfer del lienzo | `preserveDrawingBuffer` se mantiene; la copia tiene la resolución real del lienzo (también con `dpr` > 1) |
| F2 × F3 | Vidrio translúcido y desvanecido de paredes | El desvanecido multiplica la opacidad propia del vidrio (no la sustituye) |
| F1 × F3 | Con la cámara alta (60°) o en planta, el exterior podría asomar por encima de las paredes | El exterior va pegado a la cara exterior del muro y no sube por encima del hueco: con 60° queda justo al borde y en planta se ve de canto |
| F1 × F3 | Planta: paredes y marca | Las paredes se desvanecen con el azimut como siempre; desde arriba se ven de canto y el logotipo del suelo queda a la vista |
| Todas × vídeo | El vídeo del gimnasio (Remotion) cambia sin querer | Las props nuevas son opcionales: sin ellas, la composición encuadra igual que antes. Lo único que cambia en el vídeo es la sala (F3), a propósito |
| Todas × single-view | La barra o la tarjeta provocan desplazamiento | Barra y tarjeta van dentro del plano; en la app el encuadre reserva abajo la franja de la barra (10 %), como la estación |
| Todas × peso | El entorno crece | glTF de 1,86 a 2,13 MB (base64 en la app: de 2,48 a 2,85 MB, +0,37 MB): dentro del techo de 3,5 MB y de los +0,8 MB previstos |
| Todas × rendimiento | Más trabajo por fotograma | El plano solo se repinta mientras la cámara se mueve (como el giro de antes); las máquinas siguen a 15 fps. Rótulos de la marca con curvas simplificadas (de ~230 KB a ~70 KB cada uno) |

### 8.3 Verificación

Sobre la rama ya fusionada con la rama por defecto (que trae el modelo anatómico propio):

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` y `npm run lint` | Sin errores |
| `npm test` (Vitest) | 202 pruebas superadas. Nuevas: `src/scene/hubCamera.test.ts` (sin zoom la vista es la de siempre; el zoom deja quieto el punto bajo el puntero; el arrastre sigue al puntero; límites de zoom y desplazamiento; el acercamiento centra cada máquina y la deja entera a 20°, 35°, 60° y en planta; flechas) y el contrato del entorno (espejos con reflejo en UV 1, exterior tras cada ventana, marca visible con cualquier giro) |
| `npm run build` | Correcto |
| `npm run e2e` (Chromium con WebGL por software, escritorio y móvil) | 33 superadas, 7 omitidas por diseño (escritorio o móvil), 0 fallos. Incluye el «cero scroll» a 1440×900 y 1280×720 en el gimnasio y las 12 estaciones, el flujo gimnasio → tarjeta → «Abrir estación» → vuelta (sin recrear lienzos) y una prueba nueva del plano (barra de vista, planta, vista de arranque, capas, teclado y consola) |
| Revisión visual | Capturas en los tres temas y en los cuatro giros, planta, zoom con selección, móvil (Pixel 7), salas de estación (isométrica y lateral) y la copia del fundido al abrir una estación |
| Script de Blender | Horneado completo en el contenedor (~12 min en CPU); `--quick` en ~45 s; `--gpu` sin GPU sigue en la CPU («horneado en CPU») |

Ajustes que salieron de la revisión conjunta:

- La tarjeta se coloca por encima del rótulo de su máquina, que con zoom ocupa dos líneas (antes lo tapaba).
- La planta se abre siempre con la entrada abajo: el gimnasio queda apaisado y el logotipo del suelo se lee derecho (desde Iso 2 o Iso 4 salía vertical y más pequeño).
- El fundido con la estación espera a que la cámara llegue a la máquina (con un tope de 1,2 s) en lugar de un tiempo fijo, y en el plano la cámara admite pasos de tiempo mayores: en un equipo lento el acercamiento ya no se queda a medias.
- La máquina recién visitada se destaca solo con su anillo y su rótulo, sin oscurecer el resto (parecía un destello al volver).
- Los rótulos de la marca, con las curvas de las letras simplificadas, pasan de ~230 KB a ~70 KB cada uno; el del suelo es una sola cara.

**Límite conocido.** En este contenedor el WebGL es por software (1–2 fotogramas por segundo con el
gimnasio entero), así que las animaciones se han comprobado por su estado final y por la copia del
fundido, no a la velocidad real. Conviene probar el acercamiento y el pellizco en el M3 (y en un
móvil real) antes de dar F2 por cerrada.

---

## 9. Implementación de F4 y F5

Rama apilada sobre F1–F3. F3 dejó el escenario; F4 rehace la planta y F5 añade los extras.

### 9.1 F4 · Áreas

| Decisión | Implementación |
|---|---|
| **D1 · Compactar y decorar el perímetro** | El suelo pasa de 19 × 13 m (247 m²) a **17,5 × 12,5 m** (219 m², −11 %): el plano encuadra las máquinas más grandes sin tocar la cámara. Tres filas: al fondo tracción, brazos y pierna contra los espejos; en medio, empuje; delante, zona libre, entrada y cardio. El sobrante del perímetro tiene función: **cardio** (tres cintas y dos bicicletas de cara a los ventanales del este), **recepción** (mostrador con el emblema, pantalla y taburete, junto a la puerta) y **estiramientos** (esterillas, cajones, rodillos y kettlebells en la zona libre). |
| **D5 · Ritmo de máquinas** | Pasillos de **al menos 1,45 m** entre huellas (antes, 1,0 m entre el press de banca y el inclinado) y 0,65 m o más a las paredes. La prensa gira a lo largo de la fila (yaw 0) y fondos se suma a la fila de empuje. La planta vive en `src/scene/layout.ts` y `src/stations/catalog.ts`; un test (`src/scene/layout.test.ts`) vigila pasillos, paredes, zonas y que nada de lo pintado pise una máquina. |
| **D2 · Recorrido docente** | Orden de una sesión: **1 cardio → 2 empuje → 3 tracción → 4 brazos → 5 pierna → 6 zona libre**. Marcas numeradas pintadas en los pasillos y flechas que lo siguen desde la entrada (pasillo sur, oeste y norte). Los rótulos de zona del plano llevan el número, y el índice de estaciones sigue ese orden. |
| **D3 · Áreas decorativas** | Cardio, recepción y estiramientos (arriba): atrezo horneado, sin anillo ni tarjeta, con rótulo propio en el plano («1 · Cardio», «Recepción»). |
| **D4 · Suelo con personalidad** | El suelo de cada zona, su línea y el contorno del cardio en una sola malla; logotipo pintado delante de la puerta (se lee desde la vista de arranque) y marcas numeradas como señalética. Los pictogramas por zona quedan fuera: no caben sin tapar máquinas. |
| D6 · Oclusión | Con la nueva planta, la fila alta (tracción y pierna) queda al fondo en la vista de arranque; en los giros 2–3 la viñeta de la selección ya separa la máquina elegida. Sin cambios. |

### 9.2 F5 · Extras

| Decisión | Implementación |
|---|---|
| **M7 · Mini-mapa** | `src/ui/HubMiniMap.tsx`: con zoom, arriba a la derecha del plano, planta esquemática con el norte arriba (zonas, áreas, máquinas y la elegida) y el trozo que se ve; un clic o un arrastre centran el plano ahí. Se puede ocultar en Capas. |
| **M8 · Recorrido guiado** | `src/ui/HubTour.tsx`: «▶ Recorrido guiado» en el índice o `recorrido` en la consola. La cámara visita las seis paradas (7 s cada una; con «reducir movimiento», a mano), cada parada dice qué se hace y lista sus estaciones para abrirlas. Anterior, pausa, siguiente y salir; cualquier cambio de la vista del usuario lo termina. |
| **M10 · Ambiente** | Opción A del acta (§4.5), sin nuevo horneado: día, tarde y noche cambian el cielo de los ventanales y el tono de las tiras LED, y atenúan la luz horneada (`withAmbient` en `src/scene/palette.ts`). Capas del plano y de la estación, y `ambiente <dia\|tarde\|noche>`; se guarda como preferencia. |
| **Z5 · Sala de estación por zona** | Versión ligera: el suelo de la sala de cada estación toma el color de su zona del gimnasio (`withFloorTint`). Una sala distinta por zona (cinco horneados) queda para más adelante. |
| **E3 · Reflejo vivo** | `src/scene/env/LiveMirror.tsx`, capa **opcional y apagada** por defecto en la estación («Reflejo en los espejos»). Una cámara virtual, reflejo de la de la escena en el plano de las lunas, pinta solo máquina y avatar en una textura a media resolución que las lunas proyectan sobre su reflejo horneado. Es óptica real: se ve con la cámara baja y de cara a los espejos (con la cámara a 35°, un espejo vertical refleja el suelo de delante, no al avatar). Cuesta otro render de máquina y avatar por fotograma. |

Peso del entorno: el glTF pasa de 2,13 a **2,43 MB** (base64 en la app, ~3,24 MB), dentro del techo de
3,5 MB del acta; lo nuevo es sobre todo el atrezo de cardio, recepción y estiramientos.

### 9.3 Verificación

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` y `npm run lint` | Sin errores |
| `npm test` | 210 superadas. Nuevas: planta (`src/scene/layout.test.ts`: pasillos ≥ 1,4 m, paredes, zonas, áreas, marcas y flechas sin pisar máquinas), paletas de ambiente y suelo de estación, y en la cámara, del píxel al suelo y centrar en un punto (mini-mapa) |
| `npm run build` | Correcto |
| `npm run e2e` | 34 superadas, 8 omitidas por diseño, 0 fallos. Nueva: recorrido guiado (paradas, estaciones de cada parada, fin al cambiar la vista), mini-mapa con zoom, ambiente por consola y reflejo vivo en la estación. El «cero scroll» a 1440×900 y 1280×720 sigue en verde con la nueva planta |
| Revisión visual | Cuatro giros y planta con la nueva distribución, recorrido (parada de empuje), mini-mapa, noche en el gimnasio y en una estación (suelo con el color de su zona) y reflejo vivo con la cámara de cara a los espejos (se ve la espalda del avatar y la máquina) |
| Horneado | Completo en ~11 min en el contenedor; el script comprueba que el atrezo nuevo no invade ninguna máquina |
