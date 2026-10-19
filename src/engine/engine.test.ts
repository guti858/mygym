import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { DEFAULT_ANTHRO, computeSegments } from './anthropometry';
import { NEUTRAL_AXIAL, solveBody, type FootTarget, type Side } from './body';
import { classify } from './evaluate';
import { twoBoneIK } from './ik';
import { platesPerSide, describeLoad } from './load';
import { Frame, angleDeg, sampleKeys } from './math';
import { measure } from './metrics';
import { buildTimeline, locate, parseTempo } from './timeline';

const seg = computeSegments(DEFAULT_ANTHRO);

function standing() {
  const pelvisRef = new Frame(new Vector3(0, 0.53 * seg.H, 0));
  const feet = {} as Record<Side, FootTarget>;
  for (const [side, s] of [['L', 1], ['R', -1]] as const) {
    feet[side] = {
      heel: new Vector3(s * seg.hipHalfWidth, 0, -seg.heelToAnkle),
      toeDir: new Vector3(0, 0, 1),
      up: new Vector3(0, 1, 0),
    };
  }
  return solveBody({ seg, anthro: DEFAULT_ANTHRO, pelvisRef, pelvisPivot: new Vector3(), axial: NEUTRAL_AXIAL, feet });
}

describe('antropometría', () => {
  test('la cadena de pie suma la altura de las caderas', () => {
    expect(seg.thigh + seg.shank + seg.ankleHeight).toBeCloseTo(0.53 * seg.H, 5);
  });
});

describe('IK de dos huesos', () => {
  test('alcanza el objetivo y respeta las longitudes', () => {
    const root = new Vector3(0, 1, 0);
    const target = new Vector3(0.3, 0.4, 0.2);
    const r = twoBoneIK(root, target, 0.4, 0.45, new Vector3(0, 0, 1));
    expect(r.reachable).toBe(true);
    expect(r.end.distanceTo(target)).toBeLessThan(1e-6);
    expect(r.mid.distanceTo(root)).toBeCloseTo(0.4, 6);
    expect(r.mid.distanceTo(r.end)).toBeCloseTo(0.45, 6);
  });
  test('la articulación intermedia se desplaza hacia el polo', () => {
    const r = twoBoneIK(new Vector3(), new Vector3(0, -0.6, 0), 0.4, 0.4, new Vector3(0, 0, 1));
    expect(r.mid.z).toBeGreaterThan(0.1);
  });
  test('objetivo fuera de alcance: extiende y reporta el déficit', () => {
    const r = twoBoneIK(new Vector3(), new Vector3(0, -1, 0), 0.4, 0.4, new Vector3(0, 0, 1));
    expect(r.reachable).toBe(false);
    expect(r.shortfall).toBeCloseTo(0.2, 3);
  });
});

describe('medición articular', () => {
  test('postura anatómica de pie ≈ 0° en las articulaciones principales', () => {
    const m = measure(standing(), { forward: new Vector3(0, 0, 1) });
    // La IK deja la rodilla a 1e-4 m de la extensión completa (≈1,7°).
    expect(Math.abs(m['knee.flex.L']!)).toBeLessThan(2.5);
    expect(Math.abs(m['hip.flex.L']!)).toBeLessThan(2);
    expect(Math.abs(m['ankle.dorsi.L']!)).toBeLessThan(2);
    expect(Math.abs(m['trunk.incline']!)).toBeLessThan(0.01);
  });
  test('la flexión de rodilla coincide con el ángulo geométrico', () => {
    const b = standing();
    const leg = b.legs.L;
    const geo = 180 - angleDeg(leg.hjc.clone().sub(leg.knee), leg.ankle.clone().sub(leg.knee));
    expect(measure(b, { forward: new Vector3(0, 0, 1) })['knee.flex.L']).toBeCloseTo(geo, 6);
  });
});

describe('línea de tiempo', () => {
  test('tempo 3-1-1-1 con 2 repeticiones y 2 s de preparación', () => {
    const tempo = parseTempo('3-1-1-1')!;
    const tl = buildTimeline({ tempo, reps: 2, startAt: 'contraccion', setupSec: 2 });
    expect(tl.total).toBe(2 + 2 * 6);
    expect(tl.segments.map((s) => s.kind).slice(0, 5)).toEqual([
      'preparacion',
      'excentrica',
      'pausa_estiramiento',
      'concentrica',
      'pausa_contraccion',
    ]);
    const mid = locate(tl, 3.5);
    expect(mid.segment.kind).toBe('excentrica');
    expect(mid.u).toBeCloseTo(0.5, 6);
  });
  test('tempos inválidos', () => {
    expect(parseTempo('3-1-1')).toBeNull();
    expect(parseTempo('0-1-0-1')).toBeNull();
    expect(parseTempo('2-0-1-0')).not.toBeNull();
  });
});

describe('carga', () => {
  test('combinación de discos por lado', () => {
    expect(platesPerSide(32.5)).toEqual([25, 5, 2.5]);
    expect(platesPerSide(0)).toEqual([]);
  });
  test('carga efectiva en carril a 45°', () => {
    const info = describeLoad({ kind: 'discos', baseKg: 40, maxPlatesKgPerSide: 100, effectiveFactor: Math.SQRT1_2, label: '' }, 60);
    expect(info.nominalKg).toBe(100);
    expect(info.effectiveKg).toBeCloseTo(70.71, 1);
  });
});

describe('utilidades', () => {
  test('clasificación por ventanas', () => {
    expect(classify(5, [0, 10], [-5, 15])).toBe('ok');
    expect(classify(12, [0, 10], [-5, 15])).toBe('aviso');
    expect(classify(20, [0, 10], [-5, 15])).toBe('riesgo');
  });
  test('interpolación por claves', () => {
    const keys = [
      { p: 0, v: 10 },
      { p: 0.5, v: 20 },
      { p: 1, v: 0 },
    ];
    expect(sampleKeys(keys, 0.25)).toBeCloseTo(15);
    expect(sampleKeys(keys, 0.75)).toBeCloseTo(10);
    expect(sampleKeys(keys, 2)).toBe(0);
  });
});
