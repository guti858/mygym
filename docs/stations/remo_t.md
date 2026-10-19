# Remo en T

> **Borrador F0 para validar.** Se codificará en F4 con el esquema del motor.

**Mecánica:** palanca anclada al suelo (`PivotDriver` con pivote en el extremo de la barra). **Empieza en:** estiramiento (brazos extendidos) → primero concéntrica.
**Carga:** discos en el extremo libre; la resistencia efectiva depende del ángulo de la palanca (se mostrará nominal y efectiva).

## Modalidades
| Modalidad | Postura | Agarre | Énfasis |
|---|---|---|---|
| **Con apoyo de pecho** | Pecho en la almohadilla, tronco ~30–45° sobre la horizontal | — | Menor carga lumbar |
| **Libre (bisagra)** | Cadera flexionada, tronco ~30–45° sobre la horizontal, rodillas semiflexionadas | — | Exige columna neutra activa |
| **Neutro estrecho** | | Maneral en V / agarres paralelos | Dorsal, codos hacia la cadera |
| **Prono ancho** | | Agarres anchos | Trapecio medio, romboides, deltoides posterior |

## Ajuste
- **Apoyo de pecho:** altura de la almohadilla para que, con brazos extendidos, los discos no toquen el suelo y el esternón quede apoyado (no el abdomen).
- **Libre:** pies a la anchura de caderas a ambos lados de la barra; la barra pasa entre las piernas.

## Guion por fases (tempo recomendado 2-1-1-1)
- **Preparación:** columna neutra (pecho alto, sin redondear la zona lumbar), mirada al suelo ligeramente adelantada, abdomen firme.
- **Concéntrica:** juntar escápulas, después llevar los codos hacia atrás (hacia la cadera en neutro, a los lados en prono ancho); sin levantar el tronco.
- **Pausa en contracción:** 1 s con las escápulas juntas.
- **Excéntrica:** bajar en 2 s sin perder la posición de la espalda.
- **Pausa en estiramiento:** brazos extendidos, hombros ligeramente protraídos sin redondear la espalda.

## Ventanas articulares
| Ventana | Métrica | Modalidad | Correcto | Aviso | Cuándo | Confianza |
|---|---|---|---|---|---|---|
| Columna lumbar neutra | `lumbar.flex` | Ambas | −12…6° | −18…12° | siempre | Evidencia (McGill; Fenwick 2009) |
| Ángulo de tronco estable | `trunk.incline` | Libre | 45…65° | 35…75° | siempre | Práctica |
| Rodillas semiflexionadas | `knee.flex` | Libre | 10…35° | 5…50° | siempre | Práctica |
| Escápulas juntas al final | `scap.prot` | Ambas | −30…−8° | −30…0° | contracción | Consenso |
| Hombros abajo | `scap.elev` | Ambas | −15…5° | −15…12° | siempre | Consenso |
| Cuello neutro | `neck.flex` | Ambas | −15…15° | −30…25° | siempre | Práctica |
| Recorrido del codo | `elbow.flex` | Ambas | 80…130° | 65…140° | contracción | Práctica |

## Errores demostrables
| Error | Qué se ve | Consecuencia | Alerta en |
|---|---|---|---|
| Espalda redondeada | Flexión lumbar en la bisagra o al tirar | Mayor estrés discal | `lumbar.flex` |
| Tirón con la cadera | El tronco se levanta para mover la carga | Inercia y carga lumbar | `trunk.incline` |
| Hombros encogidos | Remar con los hombros hacia las orejas | Trapecio superior dominante | `scap.elev` |
| Cuello en hiperextensión | Mirar al frente forzando el cuello | Carga cervical | `neck.flex` |

## Músculos
| Músculo | Neutro estrecho | Prono ancho |
|---|---|---|
| Dorsal ancho | Principal ■■■ | Sinergista ■■ |
| Trapecio medio y romboides | Principal ■■■ | Principal ■■■ |
| Deltoides posterior | Sinergista ■■ | Sinergista ■■■ |
| Redondo mayor | Sinergista ■■ | Sinergista ■■ |
| Bíceps braquial | Sinergista ■■ | Sinergista ■ |
| Erectores espinales | Estabilizador ■■■ (libre) / ■ (apoyo) | ídem |
| Isquiotibiales y glúteo | Estabilizador ■■ (libre) | ídem |
| Flexores del antebrazo | Estabilizador ■■ | Estabilizador ■■ |

## Fuentes
- Fenwick CMJ, Brown SHM, McGill SM (2009). Comparison of different rowing exercises: trunk muscle activation and lumbar spine motion, load, and stiffness. J Strength Cond Res 23(2):350–358.
- McGill S. Low Back Disorders, 3.ª ed., 2016.
- NSCA, Essentials of Strength Training and Conditioning, 2016.

## Preguntas para tu validación
- [ ] ¿Incluimos el remo libre (bisagra) en la v1 o solo la versión con apoyo de pecho?
- [ ] ¿Ángulo de tronco objetivo en la versión libre: 45–65° desde la vertical te parece adecuado?
