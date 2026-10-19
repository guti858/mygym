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
      maxPlatesKgPerSide: number;
      /** Fracción del peso que actúa en la dirección del movimiento (p. ej. sin 45°). */
      effectiveFactor: number;
      label: string;
    };

export interface LoadInfo {
  nominalKg: number;
  effectiveKg: number;
  /** Fuerza efectiva total en newtons. */
  forceN: number;
  detail: string;
}

export function describeLoad(spec: LoadSpec, kg: number): LoadInfo {
  if (spec.kind === 'pila') {
    const effectiveKg = kg / spec.ratio;
    return {
      nominalKg: kg,
      effectiveKg,
      forceN: effectiveKg * G,
      detail:
        spec.ratio === 1
          ? `Pila ${kg} kg · polea 1:1`
          : `Pila ${kg} kg · polea ${spec.ratio}:1 → ${effectiveKg.toFixed(1)} kg en el agarre`,
    };
  }
  const total = spec.baseKg + kg;
  const effectiveKg = total * spec.effectiveFactor;
  return {
    nominalKg: total,
    effectiveKg,
    forceN: effectiveKg * G,
    detail: `Carro ${spec.baseKg} kg + discos ${kg} kg = ${total} kg · componente en el carril ≈ ${effectiveKg.toFixed(0)} kg`,
  };
}

export function clampLoad(spec: LoadSpec, kg: number): number {
  if (spec.kind === 'pila') {
    const snapped = Math.round(kg / spec.stepKg) * spec.stepKg;
    return Math.min(spec.maxKg, Math.max(spec.minKg, snapped));
  }
  const snapped = Math.round(kg / 2.5) * 2.5;
  return Math.min(spec.maxPlatesKgPerSide * 2, Math.max(0, snapped));
}

export function loadStep(spec: LoadSpec): number {
  return spec.kind === 'pila' ? spec.stepKg : 5;
}
