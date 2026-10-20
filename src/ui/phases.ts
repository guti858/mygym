import type { PhaseKind } from '../engine/timeline';

/** Color de cada fase (clases `.k-*`): el mismo en la pista, el carril del guion y el tempo. */
export const KIND_CLASS: Record<PhaseKind, string> = {
  preparacion: 'k-prep',
  excentrica: 'k-exc',
  pausa_estiramiento: 'k-pe',
  concentrica: 'k-con',
  pausa_contraccion: 'k-pc',
};

/** Abreviaturas de fase: las mismas en el tempo y en el carril del guion. */
export const PHASE_SHORT: Record<PhaseKind, string> = {
  preparacion: 'Prep.',
  excentrica: 'Exc.',
  pausa_estiramiento: 'P. est.',
  concentrica: 'Conc.',
  pausa_contraccion: 'P. cont.',
};

/** Orden de las fases en una repetición según empiece en estiramiento o en contracción. */
export const PHASE_ORDER: Record<'estiramiento' | 'contraccion', PhaseKind[]> = {
  estiramiento: ['preparacion', 'concentrica', 'pausa_contraccion', 'excentrica', 'pausa_estiramiento'],
  contraccion: ['preparacion', 'excentrica', 'pausa_estiramiento', 'concentrica', 'pausa_contraccion'],
};
