import { Vector3 } from 'three';
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
  test('sin choques: la barra pasa por delante de los muslos y el cable por delante del pecho y la cabeza', () => {
    const near = (a: Vector3, b: Vector3, c: Vector3, d: Vector3) => {
      let best = Infinity;
      for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) best = Math.min(best, a.clone().lerp(b, i / 16).distanceTo(c.clone().lerp(d, j / 16)));
      return best;
    };
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      const chest = (t: number) => seg.H * Math.pow(seg.build, 0.8) * (t < 0.3 ? 0.1 : t > 0.8 ? 0.095 : 0.118);
      for (const v of poleasContent.variants) {
        for (let i = 0; i <= 20; i += 2) {
          const r = evaluateFrame(poleasLogic, poleasContent, { anthro, seg, variantId: v.id, errorId: null, loadKg: 20, p: i / 20, phase: 'concentrica' });
          const { hook, pulley, hands, attachment } = r.machine;
          const where = `${name}/${v.id}/p=${i / 20}`;
          for (const t of [0.15, 0.3, 0.5, 0.7, 0.9]) {
            const spine = r.body.thorax.point(0, t * seg.thoracic, 0);
            expect(near(spine, spine, hook, pulley) - chest(t), `${where} cable–pecho`).toBeGreaterThan(0);
          }
          expect(near(r.body.head, r.body.head, hook, pulley) - seg.headRadius, `${where} cable–cabeza`).toBeGreaterThan(0);
          if (attachment === 'barra') for (const l of Object.values(r.body.legs)) expect(near(l.hjc, l.knee, hands.L, hands.R) - seg.r.thigh - 0.015, `${where} barra–muslos`).toBeGreaterThan(0);
        }
      }
    }
  });
});
