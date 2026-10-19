# Peck-deck (aperturas · pájaro invertido)

> **Borrador F0 para validar.** Se codificará en F4 con el esquema del motor.

**Mecánica:** palanca con pivote (`PivotDriver`): dos brazos que giran alrededor de ejes verticales alineados (aprox.) con los hombros. **Carga:** pila de placas.

## Modalidades
| Modalidad | Posición | Empieza en | Énfasis |
|---|---|---|---|
| **Aperturas (pecho)** | Espalda al respaldo, brazos abiertos | Estiramiento (brazos abiertos) | Pectoral esternal |
| **Pájaro invertido** | Pecho al respaldo, brazos delante | Estiramiento (brazos juntos delante) | Deltoides posterior, trapecio medio |
| Agarre | Manetas con brazo semiextendido · codos en almohadillas | | |

## Ajuste
- **Asiento:** manetas (o almohadillas de codo) a la altura del pecho medio; hombros ligeramente por encima de las manos.
- **Posición inicial de los brazos (aperturas):** que en el inicio los brazos no queden por detrás del plano del cuerpo.
- **Pájaro invertido:** brazos de la máquina en la posición más adelantada; agarres a la altura de los hombros.

## Guion por fases (tempo recomendado 2-1-1-1)
- **Aperturas:** escápulas apoyadas y algo retraídas; cerrar los brazos en arco con el codo semiflexionado fijo; sin adelantar los hombros al juntar las manos; volver en 2 s hasta el plano del pecho.
- **Pájaro invertido:** pecho apoyado, hombros abajo; abrir los brazos hasta el plano del cuerpo juntando escápulas sin encoger; volver en 2 s.

## Ventanas articulares
| Ventana | Métrica | Modalidad | Correcto | Aviso | Cuándo | Confianza |
|---|---|---|---|---|---|---|
| Brazos no por detrás del cuerpo | `shoulder.behind` | Aperturas | −90…10° | −90…20° | estiramiento | Consenso |
| Altura de los brazos | `shoulder.abd` | Ambas | 70…95° | 55…105° | siempre | Práctica |
| Codo semiflexionado fijo | `elbow.flex` | Ambas | 10…35° | 5…50° | siempre | Práctica |
| Escápulas atrás al inicio | `scap.prot` | Aperturas | −25…0° | −30…8° | estiramiento | Consenso |
| Hombros sin adelantarse | `scap.prot` | Aperturas | −15…10° | −20…20° | contracción | Consenso |
| Escápulas juntas al final | `scap.prot` | Pájaro invertido | −30…−5° | −30…3° | contracción | Consenso |
| Hombros abajo | `scap.elev` | Ambas | −12…5° | −12…12° | siempre | Consenso |
| Brazos hasta el plano del cuerpo | `shoulder.behind` | Pájaro invertido | −10…15° | −25…25° | contracción | Práctica |

## Errores demostrables
| Error | Qué se ve | Consecuencia | Alerta en |
|---|---|---|---|
| Brazos por detrás del cuerpo | Abducción horizontal excesiva al abrir | Estrés de la cápsula anterior del hombro | `shoulder.behind` |
| Hombros adelantados | Protracción al cerrar | El pectoral menor y el hombro anterior toman el control | `scap.prot` |
| Encogimiento | Trapecio superior tenso (sobre todo en pájaro) | Compensación | `scap.elev` |
| Asiento mal regulado | Manos muy por encima o por debajo del hombro | Cambia el músculo trabajado y estresa el hombro | `shoulder.abd` |

## Músculos
| Músculo | Aperturas | Pájaro invertido |
|---|---|---|
| Pectoral mayor (esternal) | Principal ■■■ | — |
| Pectoral mayor (clavicular) | Sinergista ■■ | — |
| Deltoides anterior | Sinergista ■■ | — |
| Deltoides posterior | — | Principal ■■■ |
| Trapecio medio y romboides | — | Sinergista ■■■ |
| Trapecio inferior | — | Sinergista ■ |
| Serrato anterior | Estabilizador ■ | — |

## Fuentes
- Welsch EA, Bird M, Mayhew JL (2005). Electromyographic activity of the pectoralis major and anterior deltoid muscles during three upper-body lifts. J Strength Cond Res 19(2):449–452.
- NSCA, Essentials of Strength Training and Conditioning, 2016.

## Preguntas para tu validación
- [ ] ¿Ambas modalidades con manetas, o la versión de codos en almohadillas como alternativa?
