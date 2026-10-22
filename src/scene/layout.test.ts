import { describe, expect, it } from 'vitest';
import { CATALOG } from '../stations/catalog';
import { hubFootprint } from '../stations/hubPlacement';
import { HUB_AREAS, HUB_FLOOR, HUB_PATH, HUB_ROUTE, HUB_ZONES } from './layout';
import { AMBIENTS, PALETTES, mixHex, withAmbient, withFloorTint } from './palette';

/** Caja de cada máquina en el suelo del gimnasio (x0, x1, z0, z1). */
function box(id: string) {
  const e = CATALOG.find((c) => c.id === id)!;
  const { half } = hubFootprint(e);
  const c = Math.abs(Math.cos(e.hub.yaw));
  const s = Math.abs(Math.sin(e.hub.yaw));
  const hx = half[0] * c + half[1] * s;
  const hz = half[0] * s + half[1] * c;
  return { x0: e.hub.x - hx, x1: e.hub.x + hx, z0: e.hub.z - hz, z1: e.hub.z + hz };
}
type Box = ReturnType<typeof box>;
const gap = (a: Box, b: Box) => Math.max(a.x0 - b.x1, b.x0 - a.x1, a.z0 - b.z1, b.z0 - a.z1);
const inRect = (x: number, z: number, r: { x: number; z: number; w: number; d: number }) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(z - r.z) <= r.d / 2;

describe('planta del gimnasio (F4 del acta)', () => {
  const ids = CATALOG.map((c) => c.id);
  it('pasillos de al menos 1,4 m entre máquinas', () => {
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) expect(gap(box(ids[i]!), box(ids[j]!)), `${ids[i]} · ${ids[j]}`).toBeGreaterThanOrEqual(1.4);
  });
  it('cada máquina dentro del suelo, a 0,6 m o más de las paredes, y en su zona', () => {
    const [W, D] = HUB_FLOOR;
    for (const e of CATALOG) {
      const b = box(e.id);
      expect(Math.min(b.x0 + W / 2, W / 2 - b.x1, b.z0 + D / 2, D / 2 - b.z1), e.id).toBeGreaterThanOrEqual(0.6);
      expect(inRect(e.hub.x, e.hub.z, HUB_ZONES[e.zone]), e.id).toBe(true);
    }
  });
  it('las áreas sin estación (cardio, recepción) no pisan ninguna máquina', () => {
    for (const a of HUB_AREAS) {
      const r = { x0: a.x - a.w / 2, x1: a.x + a.w / 2, z0: a.z - a.d / 2, z1: a.z + a.d / 2 };
      for (const id of ids) expect(gap(r, box(id)), `${a.id} · ${id}`).toBeGreaterThan(0.2);
    }
  });
  it('el recorrido docente: seis pasos, marcas y flechas por los pasillos (sin pisar máquinas)', () => {
    expect(HUB_ROUTE.map((r) => r.id)).toEqual(['cardio', 'empuje', 'traccion', 'brazos', 'pierna', 'libre']);
    const clear = (x: number, z: number, m: number) => ids.every((id) => gap({ x0: x - m, x1: x + m, z0: z - m, z1: z + m }, box(id)) > 0);
    for (const r of HUB_ROUTE) expect(clear(r.marker[0], r.marker[1], 0.35), r.id).toBe(true);
    for (let i = 1; i < HUB_PATH.length; i++) {
      const [ax, az] = HUB_PATH[i - 1]!;
      const [bx, bz] = HUB_PATH[i]!;
      for (let t = 0; t <= 1; t += 0.02) expect(clear(ax + (bx - ax) * t, az + (bz - az) * t, 0.25), `tramo ${i}`).toBe(true);
    }
  });
});

describe('ambiente y suelo de la sala de estación (F5 del acta)', () => {
  it('mezcla de colores', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#102030', 0.7)).toBe('#102030');
  });
  it('de día la paleta es la misma; tarde y noche cambian cielo y LED, y conservan la identidad', () => {
    const p = PALETTES.oscuro;
    expect(withAmbient(p, 'dia')).toBe(p);
    for (const a of AMBIENTS.filter((x) => x !== 'dia')) {
      const q = withAmbient(p, a);
      expect(q).toBe(withAmbient(p, a));
      expect(q.room.window).not.toBe(p.room.window);
      expect(q.room.floorA).toBe(p.room.floorA);
    }
    expect(withFloorTint(p, p.zone.pierna)).toBe(withFloorTint(p, p.zone.pierna));
    expect(withFloorTint(p, p.zone.pierna).room.floorA).not.toBe(p.room.floorA);
  });
});
