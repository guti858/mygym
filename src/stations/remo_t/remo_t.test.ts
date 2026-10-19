import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { remoContent } from './content';
import { REMO_HANDLE_L, REMO_PIVOT, remoLogic } from './logic';

describe('Remo en T', () => {
  test('contenido coherente', () => checkContent(remoContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(remoLogic, remoContent));
  test('cada error dispara sus alertas', () => checkErrors(remoLogic, remoContent));
  test('el maneral sigue el arco de la palanca y sube al tirar; los discos no tocan el suelo', () => {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const variantId of remoContent.variants.map((v) => v.id)) {
        const at = (p: number) => evaluateFrame(remoLogic, remoContent, { anthro, seg, variantId, errorId: null, loadKg: 40, p, phase: 'concentrica' });
        const a = at(0);
        const b = at(1);
        for (const r of [a, b]) {
          expect(Math.abs(r.machine.handle.distanceTo(REMO_PIVOT) - REMO_HANDLE_L), name).toBeLessThan(1e-6);
          expect(r.machine.sleeve.y - 0.225, `${name}/${variantId} discos`).toBeGreaterThan(0);
        }
        expect(b.machine.angle - a.machine.angle, `${name}/${variantId}`).toBeGreaterThan(5);
      }
    }
  });
});
