import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { dominadasContent } from './content';
import { dominadasLogic } from './logic';

describe('Barra de dominadas', () => {
  test('contenido coherente', () => checkContent(dominadasContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(dominadasLogic, dominadasContent));
  test('cada error dispara sus alertas', () => checkErrors(dominadasLogic, dominadasContent));
  test('manos fijas en la barra; el cuerpo sube y la barbilla pasa la barra', () => {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const variantId of dominadasContent.variants.map((v) => v.id)) {
        const at = (p: number) => evaluateFrame(dominadasLogic, dominadasContent, { anthro, seg, variantId, errorId: null, loadKg: 0, p, phase: 'concentrica' });
        const a = at(0);
        const b = at(1);
        expect(a.body.arms.L.grip.distanceTo(b.body.arms.L.grip), name).toBeLessThan(1e-6);
        expect(b.body.pelvis.origin.y - a.body.pelvis.origin.y, name).toBeGreaterThan(0.3);
        // Barbilla (aprox.: centro de la cabeza − 0,8 radios) por encima de la barra arriba.
        expect(b.body.head.y - 0.8 * seg.headRadius, `${name}/${variantId} barbilla`).toBeGreaterThan(b.machine.barY);
        // Colgado sin tocar el suelo.
        expect(Math.min(a.body.legs.L.toe.y, a.body.legs.L.heel.y, a.body.legs.L.knee.y), `${name} pies`).toBeGreaterThan(0.05);
      }
    }
  });
});
