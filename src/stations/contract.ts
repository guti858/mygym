import { expect } from 'vitest';
import { MUSCLES } from '../content/muscles';
import { ANTHRO_TEST_PROFILES, computeSegments } from '../engine/anthropometry';
import { evaluateFrame } from '../engine/evaluate';
import type { PhaseKind } from '../engine/timeline';
import type { StationContent, StationLogic } from '../engine/types';

const SAMPLES = Array.from({ length: 21 }, (_, i) => i / 20);
const phaseFor = (p: number): PhaseKind => (p === 0 ? 'pausa_estiramiento' : p === 1 ? 'pausa_contraccion' : 'concentrica');

/** Comprobaciones de contenido comunes a todas las estaciones. */
export function checkContent(content: StationContent) {
  const ids = new Set<string>();
  const errorIds = new Set(content.errors.map((e) => e.id));
  for (const v of content.variants) {
    expect(ids.has(v.id), `variante duplicada ${v.id}`).toBe(false);
    ids.add(v.id);
    expect(v.windows.length).toBeGreaterThan(0);
    expect(v.muscles.some((m) => m.role === 'principal')).toBe(true);
    for (const m of v.muscles) expect(MUSCLES[m.muscle], m.muscle).toBeDefined();
    for (const e of v.errors) expect(errorIds.has(e), `error ${e} sin definir`).toBe(true);
    for (const w of v.windows) {
      expect(w.warn[0] <= w.ok[0] && w.warn[1] >= w.ok[1], `ventana ${w.id}: warn debe contener ok`).toBe(true);
    }
    for (const phase of ['preparacion', 'concentrica', 'excentrica'] as const) {
      expect(v.cues[phase]?.length ?? 0, `${v.id} sin cues de ${phase}`).toBeGreaterThan(0);
    }
  }
  expect(content.errors.length).toBeGreaterThanOrEqual(3);
}

/** Técnica ideal: alcanzable y sin alertas para todos los perfiles antropométricos. */
export function checkIdeal<M>(logic: StationLogic<M>, content: StationContent) {
  for (const v of content.variants) {
    for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
      const seg = computeSegments(anthro);
      for (const p of SAMPLES) {
        const r = evaluateFrame(logic, content, { anthro, seg, variantId: v.id, errorId: null, loadKg: logic.defaultLoadKg, p, phase: phaseFor(p) });
        const where = `${content.id}/${v.id}/${name}/p=${p}`;
        for (const [side, arm] of Object.entries(r.body.arms)) expect(arm.shortfall, `${where} brazo ${side} no alcanza`).toBeLessThan(0.005);
        for (const [side, leg] of Object.entries(r.body.legs)) expect(leg.shortfall, `${where} pierna ${side} no alcanza`).toBeLessThan(0.005);
        const bad = r.evaluations.filter((e) => e.status !== 'ok').map((e) => `${e.window.id}${e.side ?? ''}=${e.value.toFixed(1)}`);
        expect(bad, `${where}: alertas en técnica ideal`).toEqual([]);
        expect(r.setup.length).toBeGreaterThan(0);
      }
    }
  }
}

/** Cada error demostrable dispara alertas en las métricas que declara. */
export function checkErrors<M>(logic: StationLogic<M>, content: StationContent) {
  const anthro = ANTHRO_TEST_PROFILES.p50!;
  const seg = computeSegments(anthro);
  for (const v of content.variants) {
    for (const errorId of v.errors) {
      const def = content.errors.find((e) => e.id === errorId)!;
      const flagged = new Set<string>();
      for (const p of SAMPLES) {
        const r = evaluateFrame(logic, content, { anthro, seg, variantId: v.id, errorId, loadKg: logic.defaultLoadKg, p, phase: phaseFor(p) });
        for (const e of r.evaluations) if (e.status !== 'ok') flagged.add(e.window.metric);
      }
      for (const m of def.expect) {
        if (!v.windows.some((w) => w.metric === m)) continue;
        expect(flagged.has(m), `${content.id}/${v.id}/${errorId} debería alertar en ${m}`).toBe(true);
      }
      expect(flagged.size, `${content.id}/${v.id}/${errorId} no genera ninguna alerta`).toBeGreaterThan(0);
    }
  }
}
