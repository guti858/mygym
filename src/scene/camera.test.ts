import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ANTHRO, computeSegments } from '../engine/anthropometry';
import { evaluateFrame } from '../engine/evaluate';
import { STATION_MODULES } from '../stations/modules';
import { fitCamera, project } from './camera';

const W = 1200;
const H = 900;
const margins = { top: 0.09, bottom: 0.13, side: 0.04, right: 0.22 };

function framePoints(id: string): Vector3[] {
  const mod = STATION_MODULES[id]!;
  const seg = computeSegments(DEFAULT_ANTHRO);
  const pts: Vector3[] = [];
  for (const p of [0, 0.5, 1]) {
    const r = evaluateFrame(mod.logic, mod.content, { anthro: DEFAULT_ANTHRO, seg, variantId: mod.content.variants[0]!.id, errorId: null, loadKg: mod.logic.defaultLoadKg, p, phase: 'concentrica' });
    pts.push(r.body.head, r.body.pelvis.origin, ...mod.logic.framePoints(r.machine));
    for (const s of ['L', 'R'] as const) pts.push(r.body.arms[s].grip, r.body.legs[s].toe);
  }
  return pts;
}

describe('cámara en órbita (escala estable)', () => {
  for (const id of Object.keys(STATION_MODULES)) {
    it(`${id}: misma escala desde cualquier azimut y todo dentro del encuadre`, () => {
      const pts = framePoints(id);
      const el = STATION_MODULES[id]!.content.views[0]!.elevation;
      const zooms = new Set<number>();
      for (let az = -180; az < 180; az += 20) {
        const cam = fitCamera({ azimuth: az, elevation: el, points: pts, width: W, height: H, margins, stable: true });
        zooms.add(Math.round(cam.zoom * 1000));
        for (const p of pts) {
          const [x, y] = project(cam, p);
          expect(x).toBeGreaterThanOrEqual(W * margins.side - 1);
          expect(x).toBeLessThanOrEqual(W * (1 - margins.right) + 1);
          expect(y).toBeGreaterThanOrEqual(H * margins.top - 1);
          expect(y).toBeLessThanOrEqual(H * (1 - margins.bottom) + 1);
        }
      }
      expect(zooms.size).toBe(1);
    });
  }
});
