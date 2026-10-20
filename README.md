# MyGym · Guion articular

Gimnasio isométrico en el navegador donde cada máquina es una **estación** con un avatar que ejecuta el ejercicio siguiendo un **guion articular**: fases, ángulos objetivo, rangos seguros por articulación, señales técnicas, músculos implicados y **errores típicos que se pueden demostrar**. Carga, agarre/modalidad, tempo y antropometría son configurables y recalculan la cinemática.

> Contenido educativo basado en literatura y consenso técnico (fuentes en cada estación). No sustituye la valoración de un profesional.

## Estado

| Fase | Estado |
|---|---|
| F0 · Contenido biomecánico de las 12 estaciones | ✅ En [`docs/stations/`](docs/stations), generado desde el código · guía en [`docs/VALIDACION.md`](docs/VALIDACION.md) |
| F1 · Cimientos (Vite + React + TS + Remotion + three.js, CI, Pages) | ✅ |
| F2 · Motor biomecánico (antropometría, IK, goniometría 3D, ventanas, fases, momentos) | ✅ con tests |
| F3 · Rebanada vertical: **Jalón al pecho** y **Prensa de piernas 45°** | ✅ pendiente de tu validación |
| F4a · Empuje: **press de banca**, **press inclinado**, **press militar**, **peck-deck** y **fondos** | ✅ pendiente de tu validación |
| F4b · Tracción y brazos: **dominadas**, **remo en T** y **poleas** | ✅ pendiente de tu validación |
| F4c–d · **Abductores / aductores** y **rack de mancuernas** (7 ejercicios) | ✅ pendiente de tu validación |
| Sala realista generada con **Blender** (luz horneada con Cycles) y cámara en órbita por estación | ✅ ver [`docs/ENTORNO_3D.md`](docs/ENTORNO_3D.md) |

Plan completo: [`docs/PLAN.md`](docs/PLAN.md).

## Ver la app sin instalar nada

Versión publicada en Claude (privada para el propietario; se comparte desde su menú *Compartir*): https://claude.ai/artifact/6zr9EbEEPmuqVm97Gruwm6

Para republicarla tras cambios: `npm run build:artifact` y publicar `dist/artifact.html` con los ficheros de `dist/assets/`.

GitHub Pages (https://guti858.github.io/mygym/): el workflow `pages.yml` compila la app y la publica cada vez que se actualiza la **rama por defecto** del repositorio. Requiere *Settings → Pages → Build and deployment → Source: GitHub Actions*; con *Deploy from a branch* Pages sirve el `index.html` de las fuentes (pide `/src/main.tsx`) y la página sale en blanco.

## Uso

```bash
npm install
npm run dev          # app en http://localhost:5173
npm test             # tests del motor y contrato de cada estación
npm run e2e          # pruebas de extremo a extremo (escritorio y móvil); requiere `npm run build`
npm run studio       # Remotion Studio: una composición por estación y variante
npm run docs         # regenera docs/stations/<estación>.md y la matriz muscular desde el código
npm run anatomy:bodymap  # regenera los trazados SVG del mapa muscular desde el modelo anatómico
npm run env:layout   # planta del gimnasio para el script de Blender que genera las salas
```

### Exportar un vídeo de la técnica

Cada estación es una composición de Remotion, así que la misma serie que ves en la app se puede renderizar a MP4:

```bash
npx remotion render src/remotion/index.ts prensa-medios out/prensa.mp4
npx remotion render src/remotion/index.ts jalon-prono-ancho out/jalon.mp4 --props='{"errorId":"balanceo", ...}'
```

En la app, el comando de consola `exportar` imprime el comando exacto con tus ajustes actuales.

### Consola

Pulsa `:` (o el botón *Consola*). Ejemplos: `ir jalon`, `variante supino-estrecho`, `carga 45`, `error balanceo`, `tempo 3-1-1-1`, `vista lateral`, `girar 45`, `inclinar 15`, `fase siguiente`, `angulos`, `ajuste`, `momentos`, `altura 182`, `movilidad cadera 110`, `tema terminal`, `ayuda`.

## Arquitectura

```
src/
  engine/        motor puro (sin React): antropometría, cuerpo (FK + IK de dos huesos), métricas
                 goniométricas 3D, ventanas articulares, línea de tiempo por fases, momentos, carga
  stations/      una carpeta por estación: logic.ts (cinemática de la máquina + errores),
                 content.ts (variantes, guion, ventanas, músculos, fuentes), Machine.tsx (3D) y tests
  scene/         kit de piezas paramétricas, avatar maniquí, transportadores, cámara ortográfica en órbita,
                 rayos X de la máquina; env/: salas generadas con Blender (luz horneada)
  remotion/      composiciones (estación y gimnasio): el fotograma determina fase y pose
  app/, ui/      vistas, paneles, consola, mapa muscular SVG (proyección del modelo anatómico)
  state/         estado global (zustand), URL compartible, comandos
```

- **Animación:** Remotion (`@remotion/player` en la app, `@remotion/three` para el 3D). Todo depende de `useCurrentFrame()`: no hay bucles de animación propios.
- **Coherencia entre estaciones:** cinco mecánicas compartidas (cable, palanca con pivote, carril, peso libre, peso corporal) y el mismo esquema de contenido.
- **Tests de contrato** (por estación): la técnica ideal no genera alertas para perfiles de 150 a 195 cm, fémur largo, brazos cortos/largos y poca movilidad; cada error demostrable dispara las alertas que declara.

## Sala del gimnasio (Blender)

Las salas (la de cada estación y el gimnasio completo) salen de `scripts/environment/build_rooms.py`, que usa Blender como módulo de Python (`bpy`): geometría procedural, texturas de detalle sin costuras y luz horneada con Cycles (luminarias, sol y cielo por los ventanales, con rebotes). La app tiñe cada material con el tema activo y desvanece las paredes que tapan la máquina. Evaluación del entorno, proceso y regeneración en [`docs/ENTORNO_3D.md`](docs/ENTORNO_3D.md).

## Modelo anatómico

El avatar usa músculos, huesos y piel (cabeza, manos y pies) del atlas libre [Z-Anatomy](https://www.z-anatomy.com) (CC BY-SA 4.0), derivado de [BodyParts3D](https://lifesciencedb.jp/bp3d/) © The Database Center for Life Science (CC BY-SA 2.1 Japan). Se probó Sketchfab: su API de descarga exige OAuth y cada modelo tiene su propia licencia, así que se optó por esta fuente libre y reproducible.

- `scripts/anatomy/export_zanatomy.py` (Blender como módulo de Python, `bpy`) selecciona las piezas, las simplifica, calcula los pesos de *skinning* respecto al rig del motor y mide los centros articulares. Genera `src/anatomy/data.generated.ts`, que es obra derivada y se distribuye con la misma licencia **CC BY-SA 4.0**.
- `src/anatomy/rig.ts` traduce cada postura del motor (marcos de pelvis, columna y cuello, IK de brazos y piernas, pronosupinación, dedos cerrados sobre el maneral) a una matriz por hueso; huesos auxiliares de medio giro conservan el volumen en las articulaciones.
- El modelo se carga en un fragmento aparte (~0,8 MB comprimido) y, mientras llega, se ve el maniquí simplificado.
- El mapa muscular del gimnasio («Filtrar por músculo») es una proyección frontal y dorsal del **mismo modelo**: `scripts/anatomy/bodymap-svg.ts` rasteriza la postura de referencia con prueba de profundidad, traza las fronteras entre regiones (compartidas, sin huecos ni solapes) y genera `src/ui/bodymap.generated.ts` (SVG, también CC BY-SA 4.0).

## Dependencias con licencia propia

Remotion es gratuito para particulares y empresas de hasta 3 personas; por encima hace falta licencia de empresa ([licencia de Remotion](https://www.remotion.dev/license)).
