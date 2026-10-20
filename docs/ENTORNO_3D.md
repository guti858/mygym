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
  las vistas habituales: espejos y rótulo (fondo de las vistas frontal e isométrica), ventanales con
  banco (fondo de la vista lateral), almacén de peso libre con mancuernas, discos, kettlebells y TV
  (fondo de las vistas posteriores) y espaldera, cajones, rodillos, reloj y fuente.
- **hub**: el gimnasio de 19 × 13 m con el suelo de cada zona y su línea pintada, ventanales, banda
  de ventanas altas sobre los espejos, entrada con puerta de vidrio, taquillas, fuente y plantas.
  El script comprueba que el atrezo no invade la huella de ninguna máquina.

La luz se hornea con Cycles (luminarias del techo, sol y cielo por los ventanales, con rebotes):

- superficies grandes → **atlas de luz** (segundo juego de UV);
- atrezo pequeño → **color de vértice** (cientos de islas diminutas no caben bien en un atlas);
- vidrio, espejos, LED y rótulos → sin luz horneada (material propio en la app).

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
```

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
- **Gimnasio**: giro animado en cuartos de vuelta, arrastre libre que se ajusta al cuarto más
  cercano y acercamiento a la máquina antes de abrir su estación.
- El enlace guarda el ángulo (`giro`, `incl`) además de la vista.
