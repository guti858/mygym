export const G = 9.81;

/** Discos olímpicos disponibles (kg) y su color IWF. */
export const PLATES: ReadonlyArray<{ kg: number; color: string; diameter: number; thickness: number }> = [
  { kg: 25, color: '#d7263d', diameter: 0.45, thickness: 0.055 },
  { kg: 20, color: '#1b6ac9', diameter: 0.45, thickness: 0.048 },
  { kg: 15, color: '#f2c12e', diameter: 0.4, thickness: 0.04 },
  { kg: 10, color: '#2e9e5b', diameter: 0.33, thickness: 0.034 },
  { kg: 5, color: '#e9ecef', diameter: 0.23, thickness: 0.027 },
  { kg: 2.5, color: '#343a40', diameter: 0.19, thickness: 0.022 },
  { kg: 1.25, color: '#adb5bd', diameter: 0.16, thickness: 0.018 },
];

/** Combinación voraz de discos por lado para un peso dado. Devuelve los kg de cada disco. */
export function platesPerSide(kgPerSide: number): number[] {
  const out: number[] = [];
  let rest = Math.round(kgPerSide * 100) / 100;
  for (const p of PLATES) {
    while (rest + 1e-6 >= p.kg) {
      out.push(p.kg);
      rest = Math.round((rest - p.kg) * 100) / 100;
    }
  }
  return out;
}

export type LoadSpec =
  | { kind: 'pila'; minKg: number; maxKg: number; stepKg: number; ratio: number; label: string }
  | {
      kind: 'discos';
      /** Peso del carro/barra sin discos. */
      baseKg: number;
      /** Qué soporta los discos (para el texto): carro de la máquina, barra libre o palanca anclada. */
      base: 'carro' | 'barra' | 'palanca';
      maxPlatesKgPerSide: number;
      /** Fracción del peso que actúa en el agarre (p. ej. sin 45° en un carril; brazo de palanca en una palanca). */
      effectiveFactor: number;
      /** Fracción para el peso de la base, si difiere (p. ej. una palanca con el centro de masas a mitad). */
      baseEffectiveFactor?: number;
      label: string;
    }
  | {
      /** Peso libre: el valor de carga es el peso de cada mancuerna; cada ejercicio usa una o dos. */
      kind: 'mancuernas';
      minKg: number;
      maxKg: number;
      stepKg: number;
      label: string;
    }
  | {
      /** Peso corporal: el valor de carga es + lastre (kg) o − asistencia (kg); 0 = libre. */
      kind: 'corporal';
      maxAssistKg: number;
      maxBallastKg: number;
      stepKg: number;
      label: string;
    };

export interface LoadInfo {
  nominalKg: number;
  effectiveKg: number;
  /** Fuerza efectiva total en newtons. */
  forceN: number;
  detail: string;
}

export function describeLoad(spec: LoadSpec, kg: number, bodyMassKg = 75): LoadInfo {
  if (spec.kind === 'corporal') {
    const effectiveKg = Math.max(0, bodyMassKg + kg);
    const detail =
      kg < 0
        ? `Peso corporal ${bodyMassKg} kg − asistencia ${-kg} kg = ${effectiveKg} kg`
        : kg > 0
          ? `Peso corporal ${bodyMassKg} kg + lastre ${kg} kg = ${effectiveKg} kg`
          : `Peso corporal ${bodyMassKg} kg, sin asistencia ni lastre`;
    return { nominalKg: effectiveKg, effectiveKg, forceN: effectiveKg * G, detail };
  }
  if (spec.kind === 'mancuernas') {
    return { nominalKg: kg, effectiveKg: kg, forceN: kg * G, detail: `Mancuerna de ${kg} kg` };
  }
  if (spec.kind === 'pila') {
    const effectiveKg = kg / spec.ratio;
    return {
      nominalKg: kg,
      effectiveKg,
      forceN: effectiveKg * G,
      detail:
        spec.ratio === 1
          ? `Pila ${kg} kg · polea 1:1`
          : `Pila ${kg} kg · polea ${spec.ratio}:1 → ${effectiveKg.toFixed(1).replace('.', ',')} kg en el agarre`,
    };
  }
  const total = spec.baseKg + kg;
  const effectiveKg = kg * spec.effectiveFactor + spec.baseKg * (spec.baseEffectiveFactor ?? spec.effectiveFactor);
  const perSide = kg / 2;
  return {
    nominalKg: total,
    effectiveKg,
    forceN: effectiveKg * G,
    detail:
      spec.base === 'barra'
        ? `Barra ${spec.baseKg} kg + discos ${kg} kg (${perSide} kg por lado) = ${total} kg`
        : spec.base === 'palanca'
          ? `Palanca ${spec.baseKg} kg + discos ${kg} kg = ${total} kg · en el agarre ≈ ${effectiveKg.toFixed(0)} kg (brazo de palanca)`
          : `Carro ${spec.baseKg} kg + discos ${kg} kg = ${total} kg · componente en el carril ≈ ${effectiveKg.toFixed(0)} kg`,
  };
}

/** Rango del control de carga. */
export function loadRange(spec: LoadSpec): { min: number; max: number } {
  if (spec.kind === 'pila' || spec.kind === 'mancuernas') return { min: spec.minKg, max: spec.maxKg };
  if (spec.kind === 'corporal') return { min: -spec.maxAssistKg, max: spec.maxBallastKg };
  return { min: 0, max: spec.maxPlatesKgPerSide * 2 };
}

/** Valor y unidad del control de carga (p. ej. «−20 kg asistencia»). */
export function loadValueLabel(spec: LoadSpec, kg: number): { value: string; unit: string } {
  if (spec.kind === 'corporal') {
    if (kg < 0) return { value: `−${-kg}`, unit: 'kg asistencia' };
    if (kg > 0) return { value: `+${kg}`, unit: 'kg lastre' };
    return { value: '0', unit: 'kg · libre' };
  }
  if (spec.kind === 'discos') return { value: String(kg), unit: 'kg en discos' };
  if (spec.kind === 'mancuernas') return { value: String(kg), unit: 'kg / mancuerna' };
  return { value: String(kg), unit: 'kg' };
}

/** Etiqueta breve de la carga para cabeceras (p. ej. «Asistida −20 kg»). */
export function loadShort(spec: LoadSpec, kg: number): string {
  if (spec.kind === 'corporal') return kg < 0 ? `Asistida −${-kg} kg` : kg > 0 ? `Lastre +${kg} kg` : 'Peso corporal';
  const l = loadValueLabel(spec, kg);
  return `${l.value} ${l.unit}`;
}

export function clampLoad(spec: LoadSpec, kg: number): number {
  const { min, max } = loadRange(spec);
  const step = spec.kind === 'discos' ? 2.5 : spec.stepKg;
  const snapped = Math.round(kg / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function loadStep(spec: LoadSpec): number {
  return spec.kind === 'discos' ? 5 : spec.stepKg;
}
