import { describe, expect, test } from 'vitest';
import { MUSCLE_IDS } from '../content/muscles';
import { ANATOMY_F_BIN, ANATOMY_F_MANIFEST } from './data-f.generated';
import { ANATOMY_M_BIN, ANATOMY_M_MANIFEST } from './data-m.generated';
import { MAX_REGIONS } from './materials';
import { buildModel, type AnatomyManifest } from './model';

const MODELS = {
  hombre: buildModel(ANATOMY_M_MANIFEST as unknown as AnatomyManifest, ANATOMY_M_BIN),
  mujer: buildModel(ANATOMY_F_MANIFEST as unknown as AnatomyManifest, ANATOMY_F_BIN),
};

describe('Modelo anatómico generado', () => {
  for (const [name, model] of Object.entries(MODELS)) {
    test(`${name}: cada músculo del catálogo tiene su región y caben en las tablas del material`, () => {
      expect(MUSCLE_IDS.filter((m) => !model.regions.includes(m))).toEqual([]);
      expect(model.regions.length).toBeLessThanOrEqual(MAX_REGIONS);
    });

    test(`${name}: geometrías válidas y dentro del presupuesto`, () => {
      for (const geo of [model.body, model.skin]) {
        const P = geo.getAttribute('position').array;
        expect(Array.from(P).every(Number.isFinite)).toBe(true);
        const W = geo.getAttribute('skinWeight').array as Uint8Array;
        for (let v = 0; v < W.length; v += 4) expect(W[v]! + W[v + 1]! + W[v + 2]! + W[v + 3]!).toBe(255);
        const n = P.length / 3;
        for (const i of geo.getIndex()!.array) expect(i).toBeLessThan(n);
      }
      // Presupuesto de render por avatar (triángulos tras reflejar las piezas simétricas).
      const tris = (model.body.getIndex()!.count + model.skin.getIndex()!.count) / 3;
      expect(tris).toBeLessThan(110_000);
    });

    test(`${name}: la cabeza es opaca y el tronco translúcido (canal auxiliar de la piel)`, () => {
      const P = model.skin.getAttribute('position').array;
      const A = model.skin.getAttribute('aux').array;
      const top = model.manifest.landmarks.top![1]!;
      let head = 0;
      let headOpaque = 0;
      let trunk = 0;
      let trunkOpaque = 0;
      for (let i = 0; i < A.length; i++) {
        const y = P[i * 3 + 1]!;
        if (y > top - 0.08) {
          head++;
          if (A[i]! > 250) headOpaque++;
        } else if (y < top * 0.75 && y > top * 0.5) {
          trunk++;
          if (A[i]! > 5) trunkOpaque++;
        }
      }
      expect(headOpaque / head).toBeGreaterThan(0.99);
      expect(trunkOpaque / trunk).toBeLessThan(0.01);
    });
  }
});
