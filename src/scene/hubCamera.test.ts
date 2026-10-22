import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../stations/catalog';
import { hubCorners, hubPoint } from '../stations/hubPlacement';
import { boxCorners, fitCamera, project } from './camera';
import { HUB_HOME, HUB_ISO_ELEVATION, HUB_PLAN_ELEVATION, HUB_ZOOM, clampPan, focusView, hubCamera, hubMargins, labelLevel, neighbor, panBy, zoomAt, type HubView } from './hubCamera';
import { HUB_FLOOR } from './layout';

const SIZE = { width: 1600, height: 900 };
const near = (a: readonly number[], b: readonly number[], eps = 0.5) => a.every((v, i) => Math.abs(v - b[i]!) < eps);

describe('cámara del plano del gimnasio', () => {
  it('sin zoom ni desplazamiento es la misma vista de siempre (gimnasio entero)', () => {
    for (const azimuth of [-45, 45, 135, 225]) {
      const old = fitCamera({
        azimuth,
        elevation: HUB_ISO_ELEVATION,
        points: boxCorners([-HUB_FLOOR[0] / 2, 0, -HUB_FLOOR[1] / 2], [HUB_FLOOR[0] / 2, 1.2, HUB_FLOOR[1] / 2]),
        ...SIZE,
        margins: hubMargins(),
      });
      const cam = hubCamera({ ...HUB_HOME, azimuth }, SIZE);
      expect(cam.zoom).toBeCloseTo(old.zoom, 6);
      expect(cam.target.distanceTo(old.target)).toBeLessThan(1e-9);
    }
  });

  it('el zoom con la rueda deja quieto el punto bajo el puntero', () => {
    const view: HubView = { ...HUB_HOME, zoom: 1.4, panX: 1, panZ: -0.5 };
    const cam = hubCamera(view, SIZE);
    const p = new Vector3(3, 0, -2);
    const [px, py] = project(cam, p);
    const next = zoomAt(view, cam, 1.5, px, py);
    expect(next.zoom).toBeCloseTo(2.1, 6);
    expect(near(project(hubCamera(next, SIZE), p), [px, py])).toBe(true);
  });

  it('el arrastre mueve el suelo con el puntero', () => {
    const view: HubView = { ...HUB_HOME, zoom: 2.5 };
    const cam = hubCamera(view, SIZE);
    const p = new Vector3(-2, 0, 1);
    const [x0, y0] = project(cam, p);
    const next = panBy(view, cam, 40, -25);
    expect(near(project(hubCamera(next, SIZE), p), [x0 + 40, y0 - 25])).toBe(true);
  });

  it('el zoom tiene límites y, al alejar del todo, el plano vuelve a centrarse', () => {
    const cam = hubCamera(HUB_HOME, SIZE);
    expect(zoomAt(HUB_HOME, cam, 100, 800, 450).zoom).toBe(HUB_ZOOM[1]);
    expect(zoomAt(HUB_HOME, cam, 0.01, 800, 450).zoom).toBe(HUB_ZOOM[0]);
    const off = clampPan({ ...HUB_HOME, zoom: 1, panX: 4, panZ: -3 });
    expect([off.panX, off.panZ]).toEqual([0, 0]);
    const far = clampPan({ ...HUB_HOME, zoom: 3, panX: 50, panZ: -50 });
    expect(Math.abs(far.panX)).toBeLessThan(HUB_FLOOR[0] / 2 + 1);
    expect(Math.abs(far.panZ)).toBeLessThan(HUB_FLOOR[1] / 2 + 1);
  });

  for (const elevation of [HUB_ISO_ELEVATION, 20, 60, HUB_PLAN_ELEVATION]) {
    it(`acercarse a una máquina la centra y la deja entera dentro del encuadre (elevación ${elevation}°)`, () => {
      for (const entry of CATALOG) {
        for (const azimuth of [-45, 135]) {
          const view = focusView({ ...HUB_HOME, azimuth, elevation }, hubCorners(entry), SIZE);
          expect(view.zoom).toBeGreaterThan(1.5);
          const cam = hubCamera(view, SIZE);
          for (const c of hubCorners(entry)) {
            const [x, y] = project(cam, c);
            expect(x, entry.id).toBeGreaterThan(-1);
            expect(x, entry.id).toBeLessThan(SIZE.width + 1);
            expect(y, entry.id).toBeGreaterThan(-1);
            expect(y, entry.id).toBeLessThan(SIZE.height + 1);
          }
          const [cx] = project(cam, hubPoint(entry, 0));
          expect(Math.abs(cx - SIZE.width / 2), entry.id).toBeLessThan(SIZE.width * 0.12);
        }
      }
    });
  }

  it('rótulos según el zoom', () => {
    expect(labelLevel(1)).toBe(0);
    expect(labelLevel(1.8)).toBe(1);
    expect(labelLevel(3)).toBe(2);
  });
});

describe('navegación con flechas por el plano', () => {
  const items = [
    { id: 'centro', x: 500, y: 400 },
    { id: 'derecha', x: 700, y: 420 },
    { id: 'lejos-derecha', x: 1100, y: 400 },
    { id: 'arriba', x: 520, y: 150 },
    { id: 'diagonal', x: 650, y: 650 },
  ];
  const at = (id: string) => items.find((i) => i.id === id)!;
  it('sin selección, la más cercana al centro', () => {
    expect(neighbor(items, null, 'left', { x: 520, y: 380 })).toBe('centro');
  });
  it('la más cercana en la dirección pedida', () => {
    expect(neighbor(items, at('centro'), 'right', { x: 0, y: 0 })).toBe('derecha');
    expect(neighbor(items, at('derecha'), 'right', { x: 0, y: 0 })).toBe('lejos-derecha');
    expect(neighbor(items, at('centro'), 'up', { x: 0, y: 0 })).toBe('arriba');
    expect(neighbor(items, at('centro'), 'down', { x: 0, y: 0 })).toBe('diagonal');
  });
  it('si no hay nada en esa dirección, nada', () => {
    expect(neighbor(items, at('lejos-derecha'), 'right', { x: 0, y: 0 })).toBeNull();
  });
});
