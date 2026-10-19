# Poleas (bíceps / tríceps)

> **Borrador F0 para validar.** Se codificará en F4 con el esquema del motor.

**Mecánica:** cable (`CableDriver`) con polea de altura regulable. El codo es la única articulación motora: el resto del cuerpo estabiliza.
**Carga:** pila de placas (relación 1:1 o 2:1 según la máquina; se mostrará la carga efectiva).

## Modalidades
| Modalidad | Polea | Accesorio | Empieza en | Énfasis |
|---|---|---|---|---|
| **Curl con barra recta** | Baja | Barra recta, supino | Estiramiento | Bíceps |
| **Curl con barra EZ** | Baja | EZ (semisupino) | Estiramiento | Bíceps + braquial, más cómodo para la muñeca |
| **Curl martillo con cuerda** | Baja | Cuerda, neutro | Estiramiento | Braquial y braquiorradial |
| **Extensión de tríceps en polea alta** | Alta | Barra / cuerda / V | Estiramiento (codo flexionado) | Tríceps (cabezas lateral y medial) |
| **Extensión de tríceps sobre la cabeza** | Alta o media, de espaldas | Cuerda | Estiramiento | Tríceps, porción larga (posición estirada) |

## Ajuste
- **Altura de la polea:** baja para curl; a la altura de la cabeza o por encima para extensiones.
- **Distancia a la máquina:** la que deja el cable en línea con el antebrazo a mitad de recorrido.
- **Postura:** pies a la anchura de caderas, rodillas ligeramente flexionadas, abdomen firme.

## Guion por fases (tempo recomendado 2-0-1-1)
- **Curl:** codos pegados a los costados y fijos; subir sin balancear; muñeca neutra; bajar en 2 s hasta casi extender.
- **Tríceps en polea alta:** codos pegados y quietos; extender por completo abajo; subir hasta ~90° sin que los codos se adelanten; tronco ligeramente inclinado y estable.
- **Sobre la cabeza:** codos apuntando al techo y cerca de la cabeza; bajar la cuerda detrás de la cabeza (estiramiento), extender sin arquear la zona lumbar.

## Ventanas articulares
| Ventana | Métrica | Modalidad | Correcto | Aviso | Cuándo | Confianza |
|---|---|---|---|---|---|---|
| Codo fijo (no avanza) | `shoulder.flex` | Curl | −10…20° | −20…35° | siempre | Consenso |
| Codo fijo junto al tronco | `shoulder.flex` | Polea alta | −15…15° | −25…30° | siempre | Consenso |
| Brazo arriba | `shoulder.elev` | Sobre la cabeza | 140…180° | 125…185° | siempre | Práctica |
| Recorrido completo | `elbow.flex` | Curl | 120…150° | 105…155° | contracción | Práctica |
| Extensión abajo | `elbow.flex` | Curl | 0…20° | 0…35° | estiramiento | Práctica |
| Extensión completa | `elbow.flex` | Tríceps | 0…12° | 0…25° | contracción | Práctica |
| Estiramiento | `elbow.flex` | Polea alta / sobre la cabeza | 80…110° / 110…150° | ±15° | estiramiento | Práctica |
| Muñeca neutra | `wrist.ext` | Todas | −15…15° | −30…30° | siempre | Práctica |
| Sin balanceo del tronco | `trunk.incline` | Curl / polea alta | −8…15° / 0…20° | ±10° más | siempre | Consenso |
| Zona lumbar neutra | `lumbar.flex` | Todas | −12…8° | −20…14° | siempre | Consenso |
| Hombros abajo | `scap.elev` | Todas | −10…5° | −10…12° | siempre | Práctica |

## Errores demostrables
| Error | Qué se ve | Consecuencia | Alerta en |
|---|---|---|---|
| Balanceo | El tronco se mueve para subir la carga | Menos trabajo del brazo, carga lumbar | `trunk.incline` |
| Codos que avanzan | El hombro se flexiona (curl) o se extiende (tríceps) | El deltoides o el dorsal ayudan; menos aislamiento | `shoulder.flex` |
| Muñecas dobladas | Flexión o extensión de muñeca al tirar | Sobrecarga de flexores/extensores del antebrazo | `wrist.ext` |
| Recorrido parcial | No extender o no flexionar del todo | Menos estímulo | `elbow.flex` |
| Hombros encogidos | Trapecio superior tenso | Compensación | `scap.elev` |

## Músculos
| Músculo | Curl recta / EZ | Curl martillo | Tríceps polea alta | Tríceps sobre la cabeza |
|---|---|---|---|---|
| Bíceps braquial | Principal ■■■ | Sinergista ■■ | — | — |
| Braquial y braquiorradial | Sinergista ■■ | Principal ■■■ | — | — |
| Tríceps braquial | — | — | Principal ■■■ | Principal ■■■ (porción larga) |
| Flexores del antebrazo | Estabilizador ■■ | Estabilizador ■■ | Estabilizador ■ | Estabilizador ■ |
| Recto abdominal y oblicuos | Estabilizador ■ | Estabilizador ■ | Estabilizador ■ | Estabilizador ■■ |

## Fuentes
- Oliveira LF et al. (2009). Effect of the shoulder position on the biceps brachii EMG in different dumbbell curls. J Sports Sci Med 8(1):24–29.
- Maeo S. et al. (2023). Triceps brachii hypertrophy is substantially greater after elbow extension training performed in the overhead versus neutral arm position. Eur J Sport Sci 23(7):1240–1250.
- Kholinne E. et al. (2018). The different role of each head of the triceps brachii muscle in elbow extension. Acta Orthop Traumatol Turc 52(3):201–205.
- NSCA, Essentials of Strength Training and Conditioning, 2016.

## Preguntas para tu validación
- [ ] ¿Cinco modalidades en la v1 o empezamos con tres (curl recta, tríceps polea alta, tríceps sobre la cabeza)?
- [ ] ¿Curl unilateral con agarre D como modalidad extra?
