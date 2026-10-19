# Rack de mancuernas (estación variable)

> **Borrador F0 para validar.** Catálogo inicial **cerrado en 7 ejercicios**, ampliable con el mismo esquema. Se codificará en F4.

**Mecánica:** peso libre (`FreeWeightDriver`): cada ejercicio define la trayectoria de las mancuernas; la fuerza externa es la gravedad en las manos. Incluye **banco regulable** (plano / inclinado 30°).
**Carga:** pares de mancuernas de 2 a 50 kg (2 kg hasta 10 kg; después 2,5 kg).

## Ejercicios
| Ejercicio | Material | Empieza en | Principal |
|---|---|---|---|
| Curl de bíceps de pie | 2 mancuernas | Estiramiento | Bíceps |
| Press de hombro sentado | Banco a 90° | Estiramiento | Deltoides anterior/lateral |
| Elevaciones laterales | De pie | Estiramiento | Deltoides lateral |
| Remo unilateral | Rodilla y mano en el banco | Estiramiento | Dorsal, trapecio medio |
| Press inclinado | Banco a 30° | Estiramiento | Pectoral clavicular |
| Peso muerto rumano | De pie | Contracción (de pie) | Isquiotibiales, glúteo |
| Sentadilla goblet | Una mancuerna al pecho | Contracción (de pie) | Cuádriceps, glúteo |

## Ventanas articulares por ejercicio
| Ejercicio | Ventana | Métrica | Correcto | Aviso | Cuándo | Confianza |
|---|---|---|---|---|---|---|
| Curl | Codo fijo | `shoulder.flex` | −10…20° | −20…35° | siempre | Consenso |
| Curl | Sin balanceo | `trunk.incline` | −5…8° | −12…15° | siempre | Consenso |
| Curl | Recorrido | `elbow.flex` | 120…150° | 105…155° | contracción | Práctica |
| Curl | Muñeca neutra | `wrist.ext` | −15…15° | −30…30° | siempre | Práctica |
| Press hombro | Zona lumbar apoyada | `lumbar.flex` | −15…5° | −25…10° | siempre | Consenso |
| Press hombro | Codos no por detrás | `shoulder.behind` | −45…5° | −60…12° | estiramiento | Consenso |
| Press hombro | Profundidad | `elbow.flex` | 80…110° | 65…120° | estiramiento | Práctica |
| Elev. laterales | Hasta la altura del hombro | `shoulder.abd` | 75…95° | 60…110° | contracción | Consenso |
| Elev. laterales | Codo semiflexionado | `elbow.flex` | 10…30° | 5…45° | siempre | Práctica |
| Elev. laterales | Sin encoger | `scap.elev` | −10…8° | −10…15° | siempre | Consenso |
| Elev. laterales | Sin balanceo | `trunk.incline` | −5…10° | −12…18° | siempre | Consenso |
| Remo unilateral | Columna neutra | `lumbar.flex` | −12…6° | −18…12° | siempre | Evidencia (McGill) |
| Remo unilateral | Tronco casi horizontal | `trunk.incline` | 60…90° | 50…95° | siempre | Práctica |
| Remo unilateral | Escápula atrás al final | `scap.prot` | −30…−8° | −30…0° | contracción | Consenso |
| Press inclinado | Apertura de codos | `shoulder.abd` | 40…70° | 30…80° | estiramiento | Consenso |
| Press inclinado | Escápulas retraídas | `scap.prot` | −30…−5° | −30…5° | siempre | Consenso |
| Peso muerto rumano | Columna neutra | `lumbar.flex` | −12…6° | −18…14° | siempre | Evidencia (McGill) |
| Peso muerto rumano | Rodillas semiflexionadas fijas | `knee.flex` | 10…30° | 5…40° | siempre | Práctica |
| Peso muerto rumano | Bisagra de cadera | `hip.flex` | 60…100° | 45…110° | estiramiento | Práctica |
| Peso muerto rumano | Cuello neutro | `neck.flex` | −15…15° | −25…25° | siempre | Práctica |
| Sentadilla goblet | Rodillas alineadas | `knee.valgus` | −10…8° | −15…15° | siempre | Consenso (Hewett 2005) |
| Sentadilla goblet | Columna neutra | `lumbar.flex` | −10…8° | −15…14° | siempre | Consenso |
| Sentadilla goblet | Talones apoyados | `foot.heelLift` | 0…1° | 0…6° | siempre | Práctica |
| Sentadilla goblet | Pelvis sin enrollarse | `pelvis.tilt` | −6…12° | −12…16° | siempre | Consenso |

## Errores demostrables (por ejercicio)
| Ejercicio | Errores |
|---|---|
| Curl | Balanceo (`trunk.incline`) · codos que avanzan (`shoulder.flex`) · muñecas dobladas (`wrist.ext`) |
| Press hombro | Arco lumbar (`lumbar.flex`) · codos por detrás (`shoulder.behind`) · recorrido parcial (`elbow.flex`) |
| Elevaciones laterales | Subir por encima del hombro con encogimiento (`shoulder.abd`, `scap.elev`) · balanceo (`trunk.incline`) · codos bloqueados (`elbow.flex`) |
| Remo unilateral | Espalda redondeada (`lumbar.flex`) · rotar el tronco (`trunk.incline`) · encogimiento (`scap.elev`) |
| Press inclinado | Codos a 90° (`shoulder.abd`) · hombros adelantados (`scap.prot`) · muñecas dobladas (`wrist.ext`) |
| Peso muerto rumano | Espalda redondeada (`lumbar.flex`) · convertirlo en sentadilla (`knee.flex`) · cuello en hiperextensión (`neck.flex`) |
| Sentadilla goblet | Valgo (`knee.valgus`) · talones despegados (`foot.heelLift`) · retroversión al fondo (`pelvis.tilt`, `lumbar.flex`) |

## Músculos (principales)
| Ejercicio | Principal ■■■ | Sinergistas | Estabilizadores |
|---|---|---|---|
| Curl | Bíceps | Braquial y braquiorradial | Antebrazo, core |
| Press hombro | Deltoides anterior | Deltoides lateral, tríceps, trapecio superior, serrato | Core |
| Elevaciones laterales | Deltoides lateral | Trapecio superior, deltoides anterior | Core |
| Remo unilateral | Dorsal ancho | Trapecio medio y romboides, deltoides posterior, bíceps | Erectores, oblicuos |
| Press inclinado | Pectoral clavicular | Deltoides anterior, tríceps, pectoral esternal | Serrato |
| Peso muerto rumano | Isquiotibiales | Glúteo mayor, aductor mayor | Erectores, antebrazo |
| Sentadilla goblet | Cuádriceps | Glúteo mayor, aductores | Core, erectores, sóleo |

## Fuentes
- McAllister MJ et al. (2014). Muscle activation during various hamstring exercises. J Strength Cond Res 28(6):1573–1580.
- Oliveira LF et al. (2009). Effect of the shoulder position on the biceps brachii EMG in different dumbbell curls. J Sports Sci Med 8(1):24–29.
- Saeterbakken AH, Fimland MS (2013). Effects of body position and loading modality on muscle activity and strength in shoulder presses. J Strength Cond Res 27(7):1824–1831.
- Hewett TE et al. (2005). Am J Sports Med 33(4):492–501.
- McGill S. Low Back Disorders, 3.ª ed., 2016 · NSCA, Essentials, 2016.

## Preguntas para tu validación
- [ ] ¿Estos 7 ejercicios son los que quieres en la v1? (El peso muerto rumano cubre isquiotibiales, que es el grupo más débil del resto del gimnasio.)
- [ ] ¿Elevaciones laterales hasta 90° o permitimos algo más con buena rotación escapular?
