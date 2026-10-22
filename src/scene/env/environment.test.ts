import { describe, expect, it } from 'vitest';
import { PALETTES } from '../palette';
import { GYM_ENV_GLB } from './gym-env.generated';
import { isWallKey, parseMaterialName, slotColor, wallOpacity, type WallKey } from './roomMaterials';

/** Bloque JSON del glTF binario generado por Blender. */
function gltfJson(b64: string) {
  const bin = atob(b64);
  const buf = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  expect(bin.slice(0, 4)).toBe('glTF');
  const len = new DataView(buf.buffer).getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + len))) as {
    scenes: { name: string; nodes: number[]; extras?: Record<string, unknown> }[];
    nodes: { name: string; mesh?: number; extras?: Record<string, unknown>; children?: number[] }[];
    meshes: { primitives: { attributes: Record<string, number>; material: number }[] }[];
    materials: { name: string; emissiveTexture?: { texCoord?: number }; pbrMetallicRoughness?: { baseColorTexture?: unknown } }[];
  };
}

describe('regla de visibilidad de las paredes', () => {
  const visible = (az: number) => (['xp', 'xn', 'zp', 'zn'] as WallKey[]).filter((k) => wallOpacity(k, az) > 0.99);
  it('vista isométrica: solo las dos paredes del fondo', () => {
    expect(visible(-45).sort()).toEqual(['xp', 'zn']);
    expect(visible(135).sort()).toEqual(['xn', 'zp']);
  });
  it('vista lateral: la pared del fondo y las dos de canto; la cercana, oculta', () => {
    expect(visible(-90).sort()).toEqual(['xp', 'zn', 'zp']);
    expect(wallOpacity('xn', -90)).toBe(0);
  });
  it('al girar, la pared se desvanece de forma gradual (sin saltos)', () => {
    let prev = wallOpacity('zp', -90);
    let partial = 0;
    for (let az = -90; az <= 0; az += 1) {
      const a = wallOpacity('zp', az);
      expect(Math.abs(a - prev)).toBeLessThan(0.12);
      if (a > 0.02 && a < 0.98) partial++;
      prev = a;
    }
    expect(partial).toBeGreaterThan(8);
  });
});

describe('materiales de la sala', () => {
  it('interpreta «sala/ranura~modo»', () => {
    expect(parseMaterialName('station/floor')).toEqual({ slot: 'floor', mode: 'atlas' });
    expect(parseMaterialName('hub/iron~vertex')).toEqual({ slot: 'iron', mode: 'vertex' });
    expect(parseMaterialName('hub/window~none')).toEqual({ slot: 'window', mode: 'none' });
  });
  it('zonas y discos toman su color del tema y de la norma de discos', () => {
    expect(slotColor(PALETTES.claro, 'zone_pierna')).toBe(PALETTES.claro.zone.pierna);
    expect(slotColor(PALETTES.oscuro, 'plate25')).toBe('#d7263d');
  });
});

describe('contrato con el glTF generado por Blender (scripts/environment/build_rooms.py)', () => {
  const J = gltfJson(GYM_ENV_GLB);
  it('trae las salas «station» y «hub» con su rango de luz', () => {
    const names = J.scenes.map((s) => s.name).sort();
    expect(names).toEqual(['hub', 'station']);
    for (const s of J.scenes) expect(Number(s.extras?.lightRange)).toBeGreaterThan(1);
  });
  it('cada nodo declara su pared (o ninguna) y su modo de luz', () => {
    for (const n of J.nodes) {
      const fade = n.extras?.fade;
      expect(fade === '' || isWallKey(fade), `${n.name}: fade=${String(fade)}`).toBe(true);
      expect(['atlas', 'vertex', 'none']).toContain(n.extras?.light);
    }
  });
  it('todas las ranuras tienen color en todos los temas', () => {
    const known = new Set(Object.keys({ ...PALETTES.claro.room, wallLow: 1, skirt: 1, accent: 1, frame: 1, metal: 1, pad: 1, floor: 1, sign: 1, exterior: 1 }));
    for (const m of J.materials) {
      const { slot } = parseMaterialName(m.name);
      expect(known.has(slot) || slot.startsWith('zone_') || slot.startsWith('plate'), slot).toBe(true);
    }
  });
  it('atlas en UV 1 para la luz horneada; color de vértice para el atrezo', () => {
    for (const n of J.nodes) {
      if (n.mesh === undefined) continue;
      for (const p of J.meshes[n.mesh]!.primitives) {
        const mat = J.materials[p.material]!;
        const { mode } = parseMaterialName(mat.name);
        expect(mode, `${n.name} · ${mat.name}`).toBe(n.extras?.light);
        if (mode === 'atlas') {
          expect(mat.emissiveTexture?.texCoord).toBe(1);
          expect(p.attributes.TEXCOORD_1).toBeDefined();
        }
        if (mode === 'vertex') expect(p.attributes.COLOR_0).toBeDefined();
        // Compactado (compact_glb.py): ni normales ni UV de detalle sin textura de detalle.
        expect(p.attributes.NORMAL).toBeUndefined();
        expect(p.attributes.TEXCOORD_0 !== undefined).toBe(!!mat.pbrMetallicRoughness?.baseColorTexture);
      }
    }
  });
  it('las cuatro paredes de cada sala se pueden desvanecer', () => {
    for (const room of ['station', 'hub']) {
      const keys = new Set(J.nodes.filter((n) => n.name.startsWith(`${room}/wall_`)).map((n) => n.extras?.fade));
      expect([...keys].sort()).toEqual(['xn', 'xp', 'zn', 'zp']);
    }
  });
  it('los espejos traen su reflejo horneado en UV 1', () => {
    const mirrors = J.nodes.filter((n) => n.name.includes('/mirror_') && n.mesh !== undefined);
    expect(mirrors.length).toBeGreaterThanOrEqual(13);
    for (const n of mirrors) {
      for (const p of J.meshes[n.mesh!]!.primitives) {
        expect(J.materials[p.material]!.emissiveTexture?.texCoord, n.name).toBe(1);
        expect(p.attributes.TEXCOORD_1, n.name).toBeDefined();
      }
    }
  });
  it('cada ventana tiene exterior detrás (desvanecido con su pared)', () => {
    for (const room of ['station', 'hub']) {
      const glass = J.nodes.filter((n) => n.name.startsWith(`${room}/glass_`));
      const outside = J.nodes.filter((n) => n.name.startsWith(`${room}/exterior_`));
      expect(outside.length, room).toBeGreaterThanOrEqual(glass.length);
      for (const n of outside) expect(isWallKey(n.extras?.fade), n.name).toBe(true);
    }
  });
  it('la marca se ve con cualquier giro del plano: logotipo en el suelo y en una pared de cada giro', () => {
    expect(J.nodes.some((n) => n.name === 'hub/floor_logo' && n.extras?.fade === '')).toBe(true);
    const branded = new Set(J.nodes.filter((n) => /^hub\/(sign|emblem)_/.test(n.name)).map((n) => n.extras?.fade));
    // Giro k (azimut −45° + 90°·k): las dos paredes del fondo.
    const back: WallKey[][] = [
      ['xp', 'zn'],
      ['xn', 'zn'],
      ['xn', 'zp'],
      ['xp', 'zp'],
    ];
    back.forEach((walls, k) => {
      expect((['xp', 'xn', 'zp', 'zn'] as WallKey[]).filter((w) => wallOpacity(w, -45 + 90 * k) > 0.99).sort()).toEqual([...walls].sort());
      expect(walls.some((w) => branded.has(w)), `giro ${k}`).toBe(true);
    });
    expect([...branded].sort()).toEqual(['xn', 'xp', 'zn', 'zp']);
  });
});
