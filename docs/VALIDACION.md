# Guía de validación (puertas F0 y F3)

Tu validación desbloquea la fase F4 (resto de estaciones). Hay dos cosas que revisar.

## 1. Rebanada vertical (F3): Jalón al pecho y Prensa 45°

Abre la app (`npm run dev`) y para cada estación:

- [ ] **Nivel de detalle:** ¿el guion por fases, las ventanas articulares y el ajuste de la máquina tienen el detalle que buscas?
- [ ] **Estilo visual:** maniquí articulado, máquinas del kit, transportadores sobre las articulaciones, colores por estado (verde/ámbar/rojo con icono).
- [ ] **Mecánicas:** cambiar agarre/modalidad, carga, tempo, repeticiones y vista; demostrar cada error.
- [ ] **Personalización:** cambia tu perfil (botón con tu talla) y mira cómo cambian el asiento, el rodillo o la profundidad recomendada.
- [ ] **Consola:** `:` y prueba `ayuda`.

Documentos generados desde el código, con los ángulos simulados y preguntas concretas:
[`stations/jalon.md`](stations/jalon.md) · [`stations/prensa.md`](stations/prensa.md)

Cuando valides, **el esquema queda congelado** y se replica en las 10 estaciones restantes.

## 2. Contenido de las 10 estaciones restantes (F0)

Borradores con modalidades, ajuste, guion, ventanas numéricas (con nivel de confianza), errores, músculos y fuentes:

| Zona | Estaciones |
|---|---|
| Empuje | [Fondos](stations/fondos.md) · [Press de banca](stations/press_banca.md) · [Press inclinado de pecho](stations/press_inclinado.md) · [Press militar](stations/press_militar.md) · [Peck-deck](stations/peck_deck.md) |
| Tracción | [Dominadas](stations/dominadas.md) · [Remo en T](stations/remo_t.md) |
| Brazos | [Poleas](stations/poleas.md) |
| Pierna | [Abductores / aductores](stations/abd_add.md) |
| Zona libre | [Rack de mancuernas](stations/mancuernas.md) |

Cobertura muscular de todo el gimnasio: [`muscles-matrix.md`](muscles-matrix.md).

### Cómo anotar cambios

Edita directamente los `.md` (cambia números, añade o quita errores y señales) o responde en el chat. Cada documento acaba con **preguntas para tu validación**: basta con marcar o contestar.

### Criterios que he aplicado

- Ángulos **humerotorácicos y goniométricos en 3D** (independientes de la cámara).
- Cada ventana tiene **rango correcto**, **rango de aviso** (fuera = riesgo) y **nivel de confianza**: *evidencia*, *consenso técnico* o *práctica habitual*. Donde la literatura es mixta (p. ej. el ancho de agarre en el jalón o los umbrales de profundidad en fondos) no se presenta como regla absoluta.
- Nada de cifras de EMG inventadas: la implicación muscular es cualitativa (1–3).
