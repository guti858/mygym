# Guía de validación (v1: F0, F3 y F4a–d)

Las 12 estaciones están implementadas. Tu validación cierra la v1. Hay cinco cosas que revisar.

## 1. Rebanada vertical (F3): Jalón al pecho y Prensa 45°

Abre la app (`npm run dev`) y para cada estación:

- [ ] **Nivel de detalle:** ¿el guion por fases, las ventanas articulares y el ajuste de la máquina tienen el detalle que buscas?
- [ ] **Estilo visual:** avatar anatómico (músculos y huesos), máquinas del kit, marcadores numerados con la lectura de ángulos a un lado, colores por estado (verde/ámbar/rojo con icono).
- [ ] **Mecánicas:** cambiar agarre/modalidad, carga, tempo, repeticiones y vista; demostrar cada error.
- [ ] **Personalización:** cambia tu perfil (botón con tu talla) y mira cómo cambian el asiento, el rodillo o la profundidad recomendada.
- [ ] **Consola:** `:` y prueba `ayuda`.

Documentos generados desde el código, con los ángulos simulados y preguntas concretas:
[`stations/jalon.md`](stations/jalon.md) · [`stations/prensa.md`](stations/prensa.md)

Cuando valides, **el esquema queda congelado** y se replica en el resto de estaciones.

## 2. Lotes F4c y F4d (pierna y zona libre): 2 estaciones implementadas

| Estación | Modalidades | Mecánica | Documento |
|---|---|---|---|
| Abductores / aductores | Abducción · abducción con tronco inclinado · aducción | Brazos con eje vertical junto a la rodilla, almohadillas por fuera o por dentro; rango inicial con pasador | [`abd_add.md`](stations/abd_add.md) |
| Rack de mancuernas (estación variable) | Curl · press de hombro · elevaciones laterales · remo unilateral · press inclinado · peso muerto rumano · sentadilla goblet | Peso libre: la fuerza es el peso de cada mancuerna en la mano; banco regulable (vertical, 30° o plano) | [`mancuernas.md`](stations/mancuernas.md) |

Consola: `ir abd_add`, `variante aduccion`, `ir mancuernas`, `variante goblet`, `carga 16` (kg por mancuerna). El peso muerto rumano y la goblet empiezan de pie (primero la bajada).

**Cambios respecto a los borradores F0** (cada documento los recoge en sus preguntas):

- [ ] **Abductores / aductores:** nueva ventana **rodillas a unos 90°** (70–110°); en aducción, apertura de partida de 36° por pierna.
- [ ] **Mancuernas:** carga de 2 en 2 kg en todo el rango; ventanas nuevas de **profundidad** (press inclinado 80–115° de codo, goblet 95–125° de rodilla), **recorrido del codo** en el remo (80–120°) y **extensión abajo** en el curl; en el remo rema el brazo derecho y la escápula y el codo se miden solo en ese lado; «rotar el tronco» se muestra como el tronco que se levanta.

Cobertura muscular de todo el gimnasio: [`muscles-matrix.md`](muscles-matrix.md).

## 3. Lote F4a (empuje): 5 estaciones implementadas

| Estación | Modalidades | Mecánica | Documento |
|---|---|---|---|
| Press de banca con barra | Agarre medio · cerrado · ancho | Barra libre con trayectoria en «J», soportes y brazos de seguridad | [`press_banca.md`](stations/press_banca.md) |
| Press inclinado de pecho (máquina) | Prono · neutro | Palanca convergente a 60° y respaldo a 30° | [`press_inclinado.md`](stations/press_inclinado.md) |
| Press militar (máquina) | Prono · neutro | Palanca con pivote trasero y respaldo casi vertical | [`press_militar.md`](stations/press_militar.md) |
| Peck-deck | Aperturas · pájaro invertido | Brazos con eje vertical sobre el hombro y codo fijo | [`peck_deck.md`](stations/peck_deck.md) |
| Máquina de fondos | Pectoral · tríceps; libre / asistida / lastrada | Manos fijas: es el cuerpo el que sube y baja | [`fondos.md`](stations/fondos.md) |

Para cada una, igual que en F3: detalle del guion, ajuste según tu talla, cada error demostrable y la consola (`ir banca`, `variante cerrado`, `error codos_90`; en fondos, `carga asistencia 20` o `carga lastre 10`).

**Cambios respecto a los borradores F0** que salieron al simular el movimiento con el cuerpo real (cada documento los recoge en sus preguntas):

- [ ] **Press de banca:** profundidad (codo abajo) de 75–110° a **100–142°**: con la barra en el esternón y los antebrazos verticales el codo llega a ~130°.
- [ ] **Press militar:** profundidad de 80–110° a **108–138°**: con las manos a la altura de la barbilla el codo está a ~120°.
- [ ] **Press inclinado:** nueva ventana **altura de las manos al inicio** (elevación del brazo: prono 30–58°, neutro 20–44°), que es la que detecta el asiento demasiado bajo. Con brazos cortos el asiento se baja una o dos posiciones para poder empezar a la profundidad buscada.
- [ ] **Peck-deck:** la altura de los brazos se mide con la **elevación del brazo (62–92°)** en lugar de la abducción, que no está definida con los brazos al frente. El eje de la máquina es fijo: el codo varía de ~20° a ~34° durante la repetición.
- [ ] **Fondos:** nueva métrica **apertura de los codos** (pectoral 10–45°, tríceps 0–22°) y profundidad en tríceps de **65–95°** de codo.

## 4. Lote F4b (tracción y brazos): 3 estaciones implementadas

| Estación | Modalidades | Mecánica | Documento |
|---|---|---|---|
| Barra de dominadas | Prona ancha · supina · neutra (asas paralelas); libre / asistida / lastrada | Manos fijas en la barra: el cuerpo sube y la barbilla pasa la barra | [`dominadas.md`](stations/dominadas.md) |
| Remo en T | Con apoyo de pecho o libre (bisagra) × neutro estrecho o prono ancho | Palanca anclada al suelo; el ángulo de la palanca sale de la flexión del codo con el cuerpo real | [`remo_t.md`](stations/remo_t.md) |
| Poleas | Curl con barra · curl martillo con cuerda · tríceps en polea alta · tríceps sobre la cabeza | Húmero fijo, solo gira el antebrazo; polea 2:1 | [`poleas.md`](stations/poleas.md) |

Consola: `ir dominadas`, `carga asistencia 25`, `ir remo`, `variante libre-prono`, `ir poleas`, `variante triceps-cabeza`.

**Cambios respecto a los borradores F0** (cada documento los recoge en sus preguntas):

- [ ] **Dominadas:** el recorrido arriba se mide por agarre (prona 122–152°, supina 130–160°, neutra 128–160° de codo), según lo que da la simulación con la barbilla justo por encima de la barra.
- [ ] **Remo en T:** recorrido del codo por agarre (neutro 95–125°, prono 85–115°); el maneral va 24 cm por encima de la palanca para que los discos no choquen con el pecho; errores nuevos «pecho despegado» y «recorrido corto».
- [ ] **Poleas:** 4 modalidades (sin barra EZ ni curl unilateral); en la extensión sobre la cabeza «hombros abajo» pasa a −5…18° porque con los brazos arriba la escápula se eleva de forma natural; en la polea alta «codo fijo» pasa a −10…22° (codos pegados pero algo por delante, para que la barra baje delante de los muslos); polea supuesta 2:1.

### Cómo anotar cambios

Edita directamente los `.md` (cambia números, añade o quita errores y señales) o responde en el chat. Cada documento acaba con **preguntas para tu validación**: basta con marcar o contestar.

### Criterios que he aplicado

- Ángulos **humerotorácicos y goniométricos en 3D** (independientes de la cámara).
- Cada ventana tiene **rango correcto**, **rango de aviso** (fuera = riesgo) y **nivel de confianza**: *evidencia*, *consenso técnico* o *práctica habitual*. Donde la literatura es mixta (p. ej. el ancho de agarre en el jalón o los umbrales de profundidad en fondos) no se presenta como regla absoluta.
- Nada de cifras de EMG inventadas: la implicación muscular es cualitativa (1–3).
