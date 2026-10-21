import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../engine/anthropometry';
import { SIDES, sideSign } from '../engine/body';
import { evaluateFrame } from '../engine/evaluate';
import { STATION_MODULES } from '../stations/modules';
import { ANATOMY_F_MANIFEST } from './data-f.generated';
import { ANATOMY_M_MANIFEST } from './data-m.generated';
import type { AnatomyManifest } from './model';
import { applyXf, boneMatrix, solveRig } from './rig';

const MANIFESTS = { M: ANATOMY_M_MANIFEST, F: ANATOMY_F_MANIFEST } as unknown as Record<'M' | 'F', AnatomyManifest>;

describe('Rig anatómico', () => {
  for (const mod of Object.values(STATION_MODULES)) {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const manifest = MANIFESTS[anthro.sex];
      const ctx = { landmarks: manifest.landmarks, bones: manifest.bones };
      const lm = (k: string, s: 1 | -1) => {
        const v = manifest.landmarks[k]!;
        return new Vector3(s * v[0]!, v[1]!, v[2]!);
      };
      test(`${mod.content.id} · ${name} (${anthro.sex}): las articulaciones del modelo caen sobre las del motor`, () => {
        const seg = computeSegments(anthro);
        for (const p of [0, 0.5, 1]) {
          const r = evaluateFrame(mod.logic, mod.content, {
            anthro,
            seg,
            variantId: mod.content.variants[0]!.id,
            errorId: null,
            loadKg: mod.logic.defaultLoadKg,
            p,
            phase: 'concentrica',
          });
          const xfs = solveRig(ctx, r.body);
          for (const bone of manifest.bones) {
            const m = boneMatrix(xfs.get(bone)!);
            expect(m.elements.every(Number.isFinite), bone).toBe(true);
            expect(m.determinant(), bone).toBeGreaterThan(0);
          }
          for (const side of SIDES) {
            const s = sideSign(side) as 1 | -1;
            const arm = r.body.arms[side];
            const leg = r.body.legs[side];
            const at = (bone: string, key: string) => applyXf(xfs.get(`${bone}.${side}`)!, lm(key, s));
            const close = (a: Vector3, b: Vector3, label: string) => expect(a.distanceTo(b), label).toBeLessThan(1e-6);
            close(at('girdle', 'gh'), arm.gh, 'cintura → hombro');
            close(at('humerus', 'gh'), arm.gh, 'húmero → hombro');
            close(at('humerus', 'elbow'), arm.elbow, 'húmero → codo');
            for (const b of ['fa0', 'fa1', 'fa2', 'fa3']) {
              close(at(b, 'elbow'), arm.elbow, `${b} → codo`);
              close(at(b, 'wrist'), arm.wrist, `${b} → muñeca`);
            }
            close(at('hand', 'wrist'), arm.wrist, 'mano → muñeca');
            close(at('thigh', 'hjc'), leg.hjc, 'muslo → cadera');
            close(at('thigh', 'knee'), leg.knee, 'muslo → rodilla');
            close(at('shank', 'knee'), leg.knee, 'pierna → rodilla');
            close(at('shank', 'ankle'), leg.ankle, 'pierna → tobillo');
            close(at('foot', 'ankle'), leg.ankle, 'pie → tobillo');
          }
        }
      });
    }
  }
});
