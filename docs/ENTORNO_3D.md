# Sala del gimnasio con Blender y cámara en órbita

## 1. Evaluación: ¿se puede usar Blender en este entorno?

Sí, como módulo de Python y sin interfaz. Resumen de lo probado en el contenedor de desarrollo
(4 vCPU x86_64, 15 GiB de RAM, **sin GPU**, sin Blender instalado):

| Prueba | Resultado |
|---|---|
| `pip install bpy==5.2.2` en un entorno virtual (Blender 5.2.2 LTS, Python 3.13) | ✅ ~1 min, sin dependencias del sistema |
| **Cycles por CPU** (render y horneado) | ✅ Es el motor útil aquí |
| EEVEE / Workbench | ⚠️ Necesitan EGL. Con `libegl1` + Mesa por software (`EGL_PLATFORM=surfaceless`) arrancan, pero tardan ~27 s en una imagen de 320 × 240: no compensa |
| Exportador glTF (`io_scene_gltf2`) | ✅ Varias escenas, `extras`, dos juegos de UV, color de vértice, texturas JPEG |
| Horneado de la sala de estación (atlas 1024², 64 muestras) | ✅ ~1,5 min |
| Horneado del gimnasio (atlas 2048², 64 muestras) | ✅ ~11 min |
| Desruido OIDN desde `bpy` en segundo plano | ⚠️ No es directo (el compositor de Blender 5 exige un render): se usa un filtro bilateral propio guiado por la posición y la normal horneadas |

Límites prácticos: todo se hace por script (no hay interfaz), el horneado en CPU es lento para
atlas grandes y el contenedor es efímero, así que **el script es la fuente** y su salida se versiona.
Con GPU (en local) el mismo script hornea en segundos.

## 2. Qué genera

`scripts/environment/build_rooms.py` construye dos salas con geometría procedural (sin modelos ni
texturas de terceros):

- **station**: la sala cuadrada (5,6 m) donde se ve cada máquina. Cada pared tiene su papel según
  las vistas habituales: espejos con el logotipo encima (fondo de las vistas frontal e isométrica),
  ventanales con estores y banco (fondo de la vista lateral), almacén de peso libre con mancuernas,
  discos, kettlebells y TV (fondo de las vistas posteriores) y espaldera, cajones, rodillos, reloj y
  fuente.
- **hub**: el gimnasio de 19 × 13 m con el suelo de cada zona y su línea pintada. Cada giro del plano
  levanta dos paredes (0: `xp`+`zn` · 1: `xn`+`zn` · 2: `xn`+`zp` · 3: `xp`+`zp`) y las cuatro llevan
  la marca, así que ningún giro se queda sin ella: logotipo grande sobre los espejos (`zn`, con
  ventanas altas a los lados), logotipo sobre la puerta de entrada (`zp`, con taquillas, fuente y
  TV), y tres ventanales con estores y un emblema en cada pared lateral (`xp`, `xn`, con reloj y
  plantas). En el suelo, el logotipo pintado (se lee desde la vista de arranque) y el emblema
  circular, lo único de la marca que se ve con cualquier giro.
  El script comprueba que el atrezo no invade la huella de ninguna máquina.

**Marca.** El logotipo es el de la cabecera de la app: ◢◣ (triángulos de acento) + «MYGYM» en
*Big Shoulders Display Black* + «GUION ARTICULAR» en *IBM Plex Mono SemiBold*, en relieve con las
fuentes de `scripts/environment/fonts/` (SIL Open Font License; si faltan, Blender usa su fuente de
serie). En la app, la marca toma el color del texto de la interfaz (ranura `sign`) y los triángulos,
el acento. Letra de 0,9 m sobre los espejos del gimnasio y de 0,7 m en la sala de estación.

**Ventanas.** Detrás de cada hueco hay un exterior (ranura `exterior`: cielo, edificios y árboles en
una textura de escala de grises teñida con el tema), pegado a la cara exterior del muro para que no
asome por encima de la pared con la cámara alta. El vidrio es translúcido en la app. Ni el exterior
ni el vidrio tapan el cielo que entra en el horneado.

**Espejos.** Cada luna está girada unas décimas de grado (las de verdad nunca son coplanarias) y
Cycles hornea lo que refleja de la sala estática (sin máquinas ni avatar) vista de frente. Se
guarda en escala de grises en un atlas propio (UV 1) y la app lo multiplica por el degradado del
tema; el marco es de acero oscuro.

La luz se hornea con Cycles (luminarias del techo, sol y cielo por los ventanales, con rebotes):

- superficies grandes → **atlas de luz** (segundo juego de UV);
- atrezo pequeño y el logotipo del suelo → **color de vértice** (cientos de islas diminutas no
  caben bien en un atlas);
- espejos → **reflejo horneado** (su propio atlas);
- vidrio, exterior, LED y rótulos de pared → sin luz horneada (material propio en la app).

En la app (`src/scene/env/`) cada material se convierte en `MeshBasicMaterial` = color del tema ×
textura de detalle × luz horneada: la sala no cuesta iluminación en tiempo real y sigue los tres
temas (claro, oscuro, terminal). Las sombras de la máquina y del avatar caen sobre un plano
receptor y salen de una luz fija cenital, como las luminarias horneadas.

## 3. Cómo regenerarla

```bash
python3 -m venv .venv-blender && .venv-blender/bin/pip install bpy==5.2.2
npm run env:layout   # planta (zonas, huellas de máquinas) → scripts/environment/layout.json
.venv-blender/bin/python -I scripts/environment/build_rooms.py scripts/environment/layout.json src/scene/env/gym-env
# Prueba rápida (atlas pequeños, 8 muestras, ~1 min): añadir --quick
# Con GPU (p. ej. Mac con Apple Silicon: Cycles por Metal): añadir --gpu
```

En el contenedor de desarrollo (4 vCPU, sin GPU) el horneado completo tarda unos 14 min: sala de
estación ~2 min (atlas 1024², reflejos 512²) y gimnasio ~11 min (atlas 2048², reflejos 1024²). Con
`--gpu` en un equipo con Metal, OptiX, CUDA, HIP u oneAPI, Cycles usa la primera GPU que reconoce
(el registro dice «horneado en METAL», por ejemplo); si no encuentra ninguna, sigue en la CPU.

Salida: `src/scene/env/gym-env.generated.ts` (glTF binario en base64, en un fragmento aparte del
bundle, como el modelo anatómico). El test `src/scene/env/environment.test.ts` comprueba el contrato
entre lo que exporta Blender y lo que espera la app (escenas, paredes, modos de luz, UV, ranuras).

## 4. Cámara por estación y en el gimnasio

- **Órbita con escala estable**: el zoom es el que hace caber cuerpo y máquina desde cualquier
  azimut a esa elevación, así que al girar el avatar no cambia de tamaño; solo se recentra.
- **Arrastre en dos ejes** (ratón): horizontal gira, vertical inclina (0°–89°). En pantallas táctiles
  el gesto vertical sigue desplazando la página. Teclado sobre la escena: ← → giran 15°, ↑ ↓
  inclinan 10°, Inicio vuelve a la vista. Botones ⤒ ⤓ en el panel y comando `inclinar <grados>`.
- **Transiciones**: al cambiar de vista la cámara orbita hasta la nueva por el camino más corto
  (~0,5 s); con «reducir movimiento», salto directo. Al soltar a menos de 6° de una vista, se ajusta
  a ella.
- **Rayos X**: las piezas de la máquina que tapan alguna articulación desde la cámara actual se
  vuelven translúcidas (pila de placas, torre de poleas, rodillos…), así que cualquier ángulo sirve.
- **Paredes**: las que se interponen entre la cámara y la máquina se desvanecen de forma gradual con
  el giro y dejan el zócalo, como en un corte de maqueta.
- **Gimnasio** (`src/scene/hubCamera.ts`, `src/app/HubView.tsx`, barra `src/ui/HubViewBar.tsx`):
  cuatro isométricas (Iso 1–4, giros de 90° animados, también con arrastre libre que se ajusta al
  cuarto más cercano) y **planta** (cenital, con la sala alineada con la pantalla); inclinación de
  20° a 60° (⤒ ⤓); **zoom** de 1× a 3,5× con − +, Ctrl/⌘ + rueda (o el pellizco del panel táctil) bajo
  el puntero y pellizco con dos dedos; con zoom, el arrastre **desplaza** el plano (Mayús + arrastre
  sigue girando) y el desplazamiento se limita para no salirse del suelo; ⌂ vuelve a la vista de
  arranque. Capas: rótulos de las máquinas, nombres de zona, movimiento y velocidad (½×, 1×, 2×);
  pantalla completa. Los rótulos cambian con el zoom: de lejos, zonas y nombres; más cerca, también
  el músculo principal; muy cerca, sin zonas. Teclado sobre el plano: flechas eligen la máquina
  vecina en pantalla, Intro abre, Esc suelta, + − acercan, Q E giran, 0 vuelve al arranque. Consola:
  `vista iso1…iso4|planta|inicio`, `girar 90`, `inclinar 10`, `zoom 2`.
- **Elegir y abrir una máquina**: un clic (o un toque) la **elige**: anillo de acento, el resto se
  atenúa con una viñeta y aparece una tarjeta con zona, modalidades, músculos principales y
  «Abrir estación». Un segundo clic en la misma máquina, el botón o Intro la **abre**. La zona de clic
  es la caja de cada máquina (no una caja igual para todas).
- **Del gimnasio a una estación**: la cámara del propio plano se acerca a la máquina hasta el
  encuadre con el que se abre la estación (mismos márgenes, mismo azimut y elevación) y la imagen,
  ya nítida, se funde con la estación (`src/ui/zoomTransition.ts`: copia en un lienzo superpuesto y
  fundido de 220 ms en el compositor, que no se entrecorta aunque la estación se esté montando
  debajo). La estación arranca mirando la máquina desde el mismo lado y orbita hasta su vista (si la
  diferencia es de más de 120°, empieza ya en su vista). Al volver, el plano se aleja desde la máquina
  hasta la vista que había y la deja destacada un momento. Con «reducir movimiento», todo es directo.
- **Resolución del plano**: el lienzo se pinta a la densidad de la pantalla (de 1× a 2× de la
  composición, según el tamaño real del plano): nítido en pantallas Retina sin pintar de más en las
  normales.
- El enlace de una estación guarda el ángulo (`giro`, `incl`) además de la vista.

## 5. Carga sin tirones

Medido con el perfilador de Chrome (WebGL por software, que exagera lo gráfico pero sitúa bien
dónde se bloquea el hilo principal):

| Causa | Qué pasaba | Solución |
|---|---|---|
| Salir del gimnasio | R3F destruye el contexto WebGL al desmontar (`forceContextLoss`, bloqueo síncrono) y la estación crea otro y recompila todo | Las dos vistas quedan montadas; la oculta, en pausa. Volver es instantáneo |
| Shaders nuevos (sala, modelo anatómico) | three.js espera al driver nada más usar cada programa (`onFirstUse`, `WebGLUniforms`) | Se preparan antes de mostrarlos: texturas a la GPU (una por fotograma) y `compileAsync`, que con `KHR_parallel_shader_compile` (Chrome, Edge, Firefox y Safari con GPU) compila fuera del hilo principal; mientras, se ve lo de antes (maniquí, sala procedural) |
| Comprobación de errores de shaders | Consultas síncronas al driver por cada programa | Desactivada (`tuneRenderer`): los shaders son los de three.js |
| Recursos de varios MB | Decodificar base64 en un bucle de JavaScript; evaluación encima de los primeros fotogramas | Decodificación nativa (`Uint8Array.fromBase64` donde existe); la carga empieza con el navegador libre y la sala después del modelo anatómico |
| Peso de la sala | 2,68 MB con normales y UV que no se usan | `compact_glb.py`: 1,86 MB (−31 %); con la marca, los exteriores y el reflejo de los espejos, 2,13 MB (2,85 MB en base64 dentro de la app, +15 %) |
| Esfera envolvente del avatar | three.js la calculaba aplicando los huesos a cada vértice la primera vez | Esfera fija |
| Ratón sobre el gimnasio | Los eventos probaban todas las mallas de máquinas y avatares | Solo una caja invisible por máquina |
| Gimnasio animado | 12 máquinas con avatar repintadas a 30 fps | Memoizadas y a 15 fps (la mitad de trabajo de React y de GPU) |

Sigue costando, la primera vez que se abre una estación, crear su contexto WebGL y compilar sus
shaders: lo tapa la transición. Para reducirlo más habría que precrear la vista de estación en
reposo (otro contexto vivo en segundo plano) o pasar a un único lienzo compartido.
