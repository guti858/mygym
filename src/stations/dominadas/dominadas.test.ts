import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { dominadasContent } from './content';
import { DOMINADAS_BAR_Y, dominadasLogic } from './logic';

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
      }
    }
  });
  test('sin choques: la cabeza no atraviesa la barra recta y los pies no tocan el suelo (también en los errores)', () => {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const v of dominadasContent.variants) {
        for (const errorId of [null, ...v.errors]) {
          for (let i = 0; i <= 20; i++) {
            const r = evaluateFrame(dominadasLogic, dominadasContent, { anthro, seg, variantId: v.id, errorId, loadKg: 0, p: i / 20, phase: 'concentrica' });
            const where = `${name}/${v.id}/${errorId ?? 'ideal'}/p=${i / 20}`;
            const h = r.body.head;
            expect(Math.hypot(h.y - DOMINADAS_BAR_Y, h.z) - seg.headRadius, `${where} cabeza`).toBeGreaterThan(0.03);
            for (const l of Object.values(r.body.legs)) expect(Math.min(l.toe.y, l.heel.y, l.knee.y), `${where} pies`).toBeGreaterThan(0.05);
          }
        }
      }
    }
  });
  test('con asistencia, la pila sube cuando la rodillera baja', () => {
    const anthro = ANTHRO_TEST_PROFILES.p50!;
    const seg = computeSegments(anthro);
    const lift = (p: number) => evaluateFrame(dominadasLogic, dominadasContent, { anthro, seg, variantId: 'supina', errorId: null, loadKg: -20, p, phase: 'concentrica' }).machine.stackLift;
    expect(lift(0)).toBeGreaterThan(lift(1) + 0.1);
  });
});
