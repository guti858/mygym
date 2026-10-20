import { describe, expect, it } from 'vitest';
import { MUSCLE_IDS } from '../content/muscles';
import { BODYMAP } from './bodymap.generated';

describe('mapa muscular (trazados del modelo anatómico)', () => {
  it('cada músculo del catálogo tiene región en la vista frontal o en la dorsal', () => {
    const missing = MUSCLE_IDS.filter((m) => !BODYMAP.front.regions[m] && !BODYMAP.back.regions[m]);
    expect(missing).toEqual([]);
  });

  it('las dos vistas tienen silueta y trazados SVG válidos', () => {
    for (const view of [BODYMAP.front, BODYMAP.back]) {
      expect(view.silhouette).toMatch(/^M[\d.\s-]/);
      for (const d of Object.values(view.regions)) {
        expect(d).toMatch(/^M/);
        expect(d).not.toContain('NaN');
      }
    }
  });
});
