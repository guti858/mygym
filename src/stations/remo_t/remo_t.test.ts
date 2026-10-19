import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../../engine/anthropometry';
import { evaluateFrame } from '../../engine/evaluate';
import { checkContent, checkErrors, checkIdeal } from '../contract';
import { remoContent } from './content';
import { Vector3 } from 'three';
import { REMO_HANDLE_L, REMO_PAD_LENGTH, REMO_PIVOT, REMO_PLATFORM_Y, REMO_PLATFORM_Z, remoLogic } from './logic';

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
  test('sin choques con la carga máxima: discos, tronco, piernas, plataforma y almohadilla', () => {
    const R = 0.225; // discos de 25 kg
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      const depth = 0.11 * seg.H * Math.pow(seg.build, 0.8);
      for (const v of remoContent.variants) {
        for (let i = 0; i <= 20; i++) {
          const r = evaluateFrame(remoLogic, remoContent, { anthro, seg, variantId: v.id, errorId: null, loadKg: 100, p: i / 20, phase: 'concentrica' });
          const where = `${name}/${v.id}/p=${i / 20}`;
          const { sleeve, pad, crossbar } = r.machine;
          const yz = (q: Vector3) => Math.hypot(q.y - sleeve.y, q.z - sleeve.z) - R;
          for (const t of [0.15, 0.35, 0.55, 0.75, 0.95]) expect(yz(r.body.thorax.point(0, t * seg.thoracic, depth)), `${where} disco–tronco`).toBeGreaterThan(0);
          for (const l of Object.values(r.body.legs)) {
            for (const q of [l.knee, l.toe, l.ankle, l.hjc.clone().lerp(l.knee, 0.6)]) expect(yz(q) - 0.06, `${where} disco–pierna`).toBeGreaterThan(0);
            expect(l.toe.z, `${where} punta del pie sobre la plataforma`).toBeLessThan(REMO_PLATFORM_Z.front);
          }
          // Disco frente al borde delantero de la plataforma.
          const dz = sleeve.z - REMO_PLATFORM_Z.front;
          if (dz < R) expect(sleeve.y - Math.sqrt(R * R - Math.max(0, dz) ** 2), `${where} disco–plataforma`).toBeGreaterThan(REMO_PLATFORM_Y);
          if (pad) {
            const inv = pad.q.clone().invert();
            for (let x = -0.33; x <= 0.331; x += 0.033) {
              const loc = crossbar.clone().add(new Vector3(x, 0, 0)).sub(pad.center).applyQuaternion(inv);
              const outside = Math.max(Math.abs(loc.x) - 0.16, Math.abs(loc.y) - REMO_PAD_LENGTH / 2, Math.abs(loc.z) - 0.035) - 0.016;
              expect(outside, `${where} maneral–almohadilla`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});
