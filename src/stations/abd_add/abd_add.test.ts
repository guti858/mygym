import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { abdAddContent } from './content';
import { abdAddLogic } from './logic';

describe('Abductores / aductores', () => {
  test('contenido coherente', () => checkContent(abdAddContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(abdAddLogic, abdAddContent));
  test('cada error dispara sus alertas', () => checkErrors(abdAddLogic, abdAddContent));
  test('los muslos se abren (abducción) o se cierran (aducción); los pies no tocan el suelo', () => {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const v of abdAddContent.variants) {
        const at = (p: number) => evaluateFrame(abdAddLogic, abdAddContent, { anthro, seg, variantId: v.id, errorId: null, loadKg: 35, p, phase: 'concentrica' });
        const a = at(0);
        const b = at(1);
        const opened = b.metrics['hip.abd.L']! - a.metrics['hip.abd.L']!;
        if (v.id === 'aduccion') expect(opened, `${name}/${v.id}`).toBeLessThan(-20);
        else expect(opened, `${name}/${v.id}`).toBeGreaterThan(20);
        for (const r of [a, b]) for (const l of Object.values(r.body.legs)) expect(Math.min(l.heel.y, l.toe.y), `${name}/${v.id} pies`).toBeGreaterThan(0.02);
      }
    }
  });
});
