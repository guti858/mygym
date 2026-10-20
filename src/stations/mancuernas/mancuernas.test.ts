import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame, startAtOf } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { mancuernasContent } from './content';
import { mancuernasLogic } from './logic';

describe('Rack de mancuernas', () => {
  test('contenido coherente', () => checkContent(mancuernasContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(mancuernasLogic, mancuernasContent));
  test('cada error dispara sus alertas', () => checkErrors(mancuernasLogic, mancuernasContent));
  test('el peso muerto rumano y la goblet empiezan de pie; el resto, en estiramiento', () => {
    expect(startAtOf(mancuernasLogic, 'peso-muerto')).toBe('contraccion');
    expect(startAtOf(mancuernasLogic, 'goblet')).toBe('contraccion');
    expect(startAtOf(mancuernasLogic, 'curl')).toBe('estiramiento');
  });
  test('pies en el suelo y mancuernas en las manos durante todo el recorrido', () => {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const v of mancuernasContent.variants) {
        for (let i = 0; i <= 10; i++) {
          const r = evaluateFrame(mancuernasLogic, mancuernasContent, { anthro, seg, variantId: v.id, errorId: null, loadKg: 12, p: i / 10, phase: 'concentrica' });
          const where = `${name}/${v.id}/p=${i / 10}`;
          for (const d of r.machine.dumbbells) expect(d.center.y, `${where} mancuerna sobre el suelo`).toBeGreaterThan(0.08);
          for (const l of Object.values(r.body.legs)) expect(Math.min(l.heel.y, l.toe.y), `${where} pies`).toBeGreaterThan(-0.01);
        }
      }
    }
  });
});
