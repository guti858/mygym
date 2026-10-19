import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { poleasContent } from './content';
import { poleasLogic } from './logic';

describe('Poleas', () => {
  test('contenido coherente', () => checkContent(poleasContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(poleasLogic, poleasContent));
  test('cada error dispara sus alertas', () => checkErrors(poleasLogic, poleasContent));
  test('solo se mueve el codo: el húmero queda fijo y la pila sube con el recorrido', () => {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const variantId of poleasContent.variants.map((v) => v.id)) {
        const at = (p: number) => evaluateFrame(poleasLogic, poleasContent, { anthro, seg, variantId, errorId: null, loadKg: 20, p, phase: 'concentrica' });
        const a = at(0);
        const b = at(1);
        expect(a.body.arms.L.elbow.distanceTo(b.body.arms.L.elbow), `${name}/${variantId} codo`).toBeLessThan(0.02);
        expect(b.machine.stackLift, `${name}/${variantId} pila`).toBeGreaterThan(0.05);
      }
    }
  });
});
