# Barra de dominadas

> **Borrador F0 para validar.** Se codificará en F4 con el esquema del motor.

**Mecánica:** peso corporal (`BodyweightDriver`, manos fijas en la barra y el cuerpo se mueve). **Empieza en:** estiramiento (colgado) → primero concéntrica.
**Carga:** masa corporal ± lastre o − asistencia (banda o máquina con contrapeso).

## Modalidades
| Modalidad | Agarre | Codos | Énfasis |
|---|---|---|---|
| **Prona ancha** (pull-up) | Palmas al frente, ~1,5× anchura de hombros | Hacia los costados | Dorsal, redondo mayor, trapecio inferior |
| **Supina** (chin-up) | Palmas hacia ti, anchura de hombros | Delante y abajo | Dorsal + bíceps |
| **Neutra** | Palmas enfrentadas (agarres paralelos) | Pegados | Dorsal + braquial / braquiorradial |
| Modo de carga | Libre · asistida · lastrada | | |

## Ajuste
- Altura de la barra: colgado con brazos extendidos sin que los pies toquen el suelo (o rodillas flexionadas).
- Asistencia: la mínima que permita 5–10 repeticiones completas.

## Guion por fases (tempo recomendado 3-1-1-1)
- **Preparación:** colgado activo: brazos extendidos, escápulas ligeramente deprimidas (no «colgando de los ligamentos»), abdomen firme y piernas juntas.
- **Concéntrica:** iniciar bajando las escápulas, después flexionar codos llevándolos hacia los costados; pecho hacia la barra, barbilla por encima sin estirar el cuello.
- **Pausa en contracción:** 1 s arriba, hombros lejos de las orejas.
- **Excéntrica:** bajar en 2–3 s hasta extensión completa controlada.
- **Pausa en estiramiento:** colgado activo, sin balanceo.

## Ventanas articulares
| Ventana | Métrica | Correcto | Aviso | Cuándo | Confianza |
|---|---|---|---|---|---|
| Colgado activo | `scap.elev` | 0…15° | 0…22° | estiramiento | Práctica |
| Escápulas abajo arriba | `scap.elev` | −15…3° | −15…10° | contracción | Consenso |
| Extensión completa abajo | `elbow.flex` | 3…25° | 0…35° | estiramiento | Práctica |
| Barbilla sobre la barra | `elbow.flex` | 110…160° | 95…165° | contracción | Práctica |
| Cuello neutro | `neck.flex` | −15…12° | −25…20° | siempre | Consenso |
| Sin balanceo del tronco | `trunk.incline` | −25…5° | −35…12° | movimiento | Práctica |
| Sin kipping de cadera | `hip.flex` | −5…30° | −10…50° | movimiento | Práctica |
| Zona lumbar estable | `lumbar.flex` | −12…10° | −20…18° | siempre | Consenso |

## Errores demostrables
| Error | Qué se ve | Consecuencia | Alerta en |
|---|---|---|---|
| Kipping / impulso | Balanceo de piernas y cadera para subir | Menos trabajo dorsal, carga brusca en el hombro | `hip.flex`, `trunk.incline` |
| Recorrido parcial | No llegar a extender abajo o no pasar la barbilla | Menos estímulo en los extremos del rango | `elbow.flex` |
| Hombros encogidos | Tirar con los hombros hacia las orejas | Trapecio superior dominante | `scap.elev` |
| Estirar el cuello | Hiperextender el cuello para «llegar» | Carga cervical | `neck.flex` |

## Músculos
| Músculo | Prona ancha | Supina | Neutra |
|---|---|---|---|
| Dorsal ancho | Principal ■■■ | Principal ■■■ | Principal ■■■ |
| Bíceps braquial | Sinergista ■■ | Principal ■■■ | Sinergista ■■ |
| Braquial y braquiorradial | Sinergista ■■ | Sinergista ■■ | Sinergista ■■■ |
| Redondo mayor | Sinergista ■■ | Sinergista ■■ | Sinergista ■■ |
| Trapecio inferior | Sinergista ■■ | Sinergista ■ | Sinergista ■ |
| Trapecio medio y romboides | Sinergista ■■ | Sinergista ■ | Sinergista ■■ |
| Pectoral mayor (esternal) | — | Sinergista ■ | — |
| Flexores del antebrazo | Estabilizador ■■■ | Estabilizador ■■ | Estabilizador ■■ |
| Recto abdominal y oblicuos | Estabilizador ■■ | Estabilizador ■■ | Estabilizador ■■ |

## Fuentes
- Youdas JW et al. (2010). Surface electromyographic activation patterns and elbow joint motion during a pull-up, chin-up, or perfect-pullup rotational exercise. J Strength Cond Res 24(12):3404–3414.
- Dickie JA et al. (2017). Electromyographic analysis of muscle activation during pull-up variations. J Electromyogr Kinesiol 32:30–36.
- NSCA, Essentials of Strength Training and Conditioning, 2016.

## Preguntas para tu validación
- [ ] ¿Exigimos «colgado activo» abajo o aceptamos el colgado pasivo como correcto (es habitual y no está claro que sea perjudicial)?
- [ ] ¿Barbilla sobre la barra o pecho a la barra como criterio de recorrido completo?
