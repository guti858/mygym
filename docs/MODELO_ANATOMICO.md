# Modelo anatómico propio

El avatar de las estaciones y del gimnasio es un modelo **generado por código**, sin mallas de terceros: hombre y mujer, con los músculos a la vista bajo una piel envolvente translúcida. Sustituye al modelo derivado de Z-Anatomy/BodyParts3D (CC BY-SA), que se ha retirado del repositorio.

- Generador: [`scripts/anatomy/gen/`](../scripts/anatomy/gen) (`npm run anatomy:build`, unos 4 s por sexo).
- Resultado: `src/anatomy/data-m.generated.ts` y `src/anatomy/data-f.generated.ts` (manifiesto JSON + binario base64). La app solo descarga el del sexo elegido.
- Medición frente a medias antropométricas: `npm run anatomy:measure -- M|F`.
- Vista previa en reposo o posado por el motor (solo desarrollo): con `npm run dev`, abrir `/scripts/anatomy/preview/index.html?sex=F&skin=1` o `?station=press_militar&p=1&skin=solid&act=deltoides_anterior`.
- El mapa muscular del gimnasio sale del mismo modelo: `npm run anatomy:bodymap`.

## Cómo se construye

| Paso | Fichero | Qué hace |
|---|---|---|
| 1. Esqueleto | `skeleton.ts` | Centros articulares y puntos de inserción en postura «A» (brazos a 35°, caderas algo abiertas, palmas al frente) con **las mismas proporciones que el motor** (`computeSegments`): el rig apenas tiene que estirar el modelo. Dedos y pulgar con su curvatura de reposo. |
| 2. Capa profunda | `body.ts` | Hueso y musculatura profunda como unión suave de primitivas con distancia con signo (SDF): caja costal con arcos posteriores junto a la columna, abdomen, pelvis, escápulas, cuello y segmentos de los miembros. Es lo que se ve entre músculo y músculo. |
| 3. Músculos | `muscles.ts`, `loft.ts` | 44 músculos por lado como **láminas de fibras**: estaciones del origen a la inserción (puntos sobre el núcleo en coordenadas del tronco o cilíndricas de cada segmento) y semigrosor por estación. La superficie media se apoya en la capa de debajo (proyección sobre la isosuperficie a la altura del semigrosor), se alisa y se le da una sección elíptica. Se apilan por capas (p. ej. bíceps sobre braquial, gemelo sobre sóleo, trapecio sobre infraespinoso). Los extremos tendinosos salen como piezas de tendón. |
| 4. Piel | `build.ts`, `body.ts` | Isosuperficie a la distancia «grasa» (variable por regiones y por sexo) de la unión de núcleo y músculos, más cabeza de maniquí, orejas y mamas. Mallado con *surface nets* y simplificación por error cuadrático (meshoptimizer, solo en desarrollo). La cabeza es opaca; el resto, translúcido. |
| 5. Acabados | `body.ts` | Guantes con dedos articulados, zapatillas (pie engrosado + suela plana sobre el suelo), pelo (corto o con moño), ojos y huesos que se notan (clavícula, rótula). |
| 6. Pesos | `weights.ts` | Por proximidad a formas óseas propias, con suavizado sobre la malla. El tronco cuenta como un único hueso frente a los miembros y luego se reparte entre pelvis, lumbar, tórax y cuello por altura (la columna se dobla de forma continua). Antebrazo en 4 bandas de pronosupinación y huesos auxiliares de medio giro en cada articulación. |
| 7. Empaquetado | `pack.ts` | Posiciones cuantizadas a 16 bits, índices de 16 bits por pieza, 4 influencias de 8 bits y un canal auxiliar de 8 bits (abultamiento del vientre muscular / opacidad de la piel). Solo se guarda el lado izquierdo de lo simétrico. |

El rig de ejecución (`src/anatomy/rig.ts`) no cambia: el modelo trae los mismos huesos y puntos que el anterior, y `rig.test.ts` comprueba en las 12 estaciones y en todos los perfiles (hombre y mujer) que las articulaciones del modelo caen sobre las del motor.

## En la app

- **Una malla opaca por avatar** (músculos, tendones, capa profunda, huesos, guantes, calzado, pelo y ojos) con un atributo de región; color, brillo, rugosidad y abultamiento de cada región salen de tablas de uniformes (`src/anatomy/materials.ts`). Cambiar qué músculos trabajan es escribir uniformes: sin materiales por pieza ni recompilar.
- **La piel** es la segunda malla: translúcida con el contorno marcado (Fresnel) cuando se ven los músculos y opaca cuando se ocultan (*Capas* → músculos, o `mostrar musculos no` en la consola), sin cambiar de programa de GPU.
- **Contracción**: el vientre de los músculos que trabajan se ensancha hasta 4,5 mm según su nivel y la fase (en el vertex shader, sin coste de CPU).
- **Hombre / mujer**: en *Tu cuerpo* o con `cuerpo mujer`. El sexo también ajusta en el motor la anchura de hombros, cadera y tórax y los perímetros (medias de ANSUR II normalizadas por la talla), así que el ajuste de las máquinas sigue al cuerpo que se ve.

## Calibración

Perímetros de la piel frente a medias antropométricas aproximadas (ANSUR II, escaladas a la talla del modelo; brazo y antebrazo, cortados perpendiculares al segmento):

| | Hombre (173,5 cm) | Mujer (161,6 cm) |
|---|---|---|
| Cuello | 40,7 cm (+5 %) | 34,3 cm (+7 %) |
| Pecho | 109,5 cm (+8 %) | 103,3 cm (+12 %) |
| Cintura | 92,7 cm (+6 %) | 79,6 cm (+5 %) |
| Cadera | 99,3 cm (0 %) | 97,9 cm (−4 %) |
| Muslo | 55,5 cm (−7 %) | 56,2 cm (−6 %) |
| Gemelo | 40,0 cm (+4 %) | 38,0 cm (+4 %) |
| Brazo | 30,5 cm (−4 %) | 26,4 cm (−6 %) |
| Antebrazo | 29,4 cm (+3 %) | 24,9 cm (+2 %) |

Contactos que supone el motor (respaldos y almohadillas, `src/stations/common.ts`): espalda alta a −11,1 cm (motor −11,7) y esternón a 12,6 cm (motor 12,8) en el hombre; −10,6 / 11,6 cm (motor −10,9 / 11,9) en la mujer.

## Rendimiento

Medido con la build de producción frente a la rama por defecto anterior (Chromium; las llamadas WebGL se cuentan interceptándolas, sin tocar el código):

| | Antes (Z-Anatomy) | Ahora |
|---|---|---|
| Descarga del modelo | 1,60 MB (796 KB gzip), uno solo | 0,80 MB (358 KB gzip) por sexo |
| Importar el módulo / decodificar y montar (Node) | 109 ms / 35 ms | 23 ms / 16 ms |
| Mallas por avatar | ~33 (una por grupo) | 2 |
| Gimnasio (12 avatares): llamadas de dibujo / triángulos por fotograma | 1399 / 2,07 M | 1027 / 0,93 M |
| Estación: llamadas de dibujo / triángulos por fotograma | 243 / 216 k | 195 / 83 k |

## Límites conocidos

- Es un modelo estilizado (maniquí con músculos), no anatómicamente exhaustivo: faltan músculos profundos (romboides, supraespinoso, esplenios…) que quedan en la capa profunda.
- La deformación es *skinning* lineal con huesos auxiliares; en flexiones extremas los músculos pueden asomar un poco a través de la piel opaca (en la vista con músculos no se aprecia).
- El abultamiento por contracción es visual (proporcional al nivel de activación), no una simulación de volumen.
