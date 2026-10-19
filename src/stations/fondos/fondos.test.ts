import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { fondosContent } from './content';
import { fondosLogic } from './logic';

describe('Máquina de fondos', () => {
  test('contenido coherente', () => checkContent(fondosContent));
  test('técnica ideal sin alertas (P5–P95)', () => checkIdeal(fondosLogic, fondosContent));
  test('cada error dispara sus alertas', () => checkErrors(fondosLogic, fondosContent));
  test('las manos no se mueven: el cuerpo sube y baja', () => {
    const anthro = ANTHRO_TEST_PROFILES.p50!;
    const seg = computeSegments(anthro);
    const at = (p: number) => evaluateFrame(fondosLogic, fondosContent, { anthro, seg, variantId: 'pectoral', errorId: null, loadKg: 0, p, phase: 'concentrica' });
    const a = at(0);
    const b = at(1);
    expect(a.body.arms.L.grip.distanceTo(b.body.arms.L.grip)).toBeLessThan(1e-6);
    expect(b.body.pelvis.origin.y - a.body.pelvis.origin.y).toBeGreaterThan(0.15);
  });
  test('asistencia y lastre cambian la carga efectiva', () => {
    const anthro = ANTHRO_TEST_PROFILES.p50!;
    const seg = computeSegments(anthro);
    const force = (kg: number) => evaluateFrame(fondosLogic, fondosContent, { anthro, seg, variantId: 'triceps', errorId: null, loadKg: kg, p: 0.5, phase: 'concentrica' }).forces[0]!.force.y;
    expect(force(-20)).toBeLessThan(force(0));
    expect(force(20)).toBeGreaterThan(force(0));
  });
});
