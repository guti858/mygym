import { writeFileSync } from 'node:fs';
import type { Sex } from '../../../src/engine/anthropometry';
import { BONES, HELPER_PAIRS } from './weights';
import type { V3 } from './sdf';

/** Pieza lista para empaquetar. */
export interface Item {
  name: string;
  group: string;
  kind: 'muscle' | 'tendon' | 'core' | 'skin' | 'bone' | 'detail';
  /** Pieza del lado izquierdo que se refleja en tiempo de ejecución. */
  mirror: boolean;
  P: Float32Array;
  T: Uint32Array;
  skinIndex: Uint8Array;
  skinWeight: Uint8Array;
  /** 0–1 por vértice: abultamiento (músculo) u opacidad de la piel (cabeza opaca). */
  aux: Float32Array;
}

/**
 * Escribe el módulo TypeScript del modelo: manifiesto JSON + binario base64 con posiciones
 * cuantizadas a 16 bits en la caja del modelo, índices locales de 16 bits por pieza, 4 influencias
 * de 8 bits por vértice y el canal auxiliar de 8 bits.
 */
export function writeModule(out: string, sex: Sex, items: readonly Item[], landmarks: Record<string, V3>): { bytes: number; vertices: number; triangles: number } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const it of items) for (let i = 0; i < it.P.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, it.P[i + k]!);
    hi[k] = Math.max(hi[k]!, it.P[i + k]!);
  }
  for (let k = 0; k < 3; k++) {
    lo[k]! -= 1e-4;
    hi[k]! += 1e-4;
  }
  const nv = items.reduce((s, it) => s + it.P.length / 3, 0);
  const ni = items.reduce((s, it) => s + it.T.length, 0);
  const pos = new Uint16Array(nv * 3);
  const idx = new Uint16Array(ni);
  const si = new Uint8Array(nv * 4);
  const sw = new Uint8Array(nv * 4);
  const aux = new Uint8Array(nv);
  const objects: unknown[] = [];
  let vo = 0;
  let io = 0;
  for (const it of items) {
    const n = it.P.length / 3;
    if (n > 65535) throw new Error(`${it.name}: demasiados vértices (${n})`);
    for (let i = 0; i < n * 3; i++) {
      const k = i % 3;
      pos[vo * 3 + i] = Math.round(((it.P[i]! - lo[k]!) / (hi[k]! - lo[k]!)) * 65535);
    }
    idx.set(it.T, io);
    si.set(it.skinIndex, vo * 4);
    sw.set(it.skinWeight, vo * 4);
    for (let i = 0; i < n; i++) aux[vo + i] = Math.round(Math.min(1, Math.max(0, it.aux[i]!)) * 255);
    objects.push({ name: it.name, group: it.group, kind: it.kind, mirror: it.mirror, v: [vo, n], i: [io, it.T.length] });
    vo += n;
    io += it.T.length;
  }
  const chunks = [pos, idx, si, sw, aux].map((a) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
  const layout: Record<string, [number, number]> = {};
  let off = 0;
  ['position', 'index', 'skinIndex', 'skinWeight', 'aux'].forEach((k, i) => {
    layout[k] = [off, chunks[i]!.byteLength];
    off += chunks[i]!.byteLength;
  });
  const blob = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const helpers: Record<string, string[]> = {};
  for (const [k, h] of HELPER_PAIRS) helpers[h] = k.split('|');
  const manifest = {
    sex,
    bones: BONES,
    helpers,
    bbox: [lo.map((v) => +v.toFixed(6)), hi.map((v) => +v.toFixed(6))],
    counts: { vertices: nv, indices: ni },
    layout,
    landmarks: Object.fromEntries(Object.entries(landmarks).map(([k, v]) => [k, v.map((x) => +x.toFixed(5))])),
    objects,
  };
  const header =
    '// Generado por scripts/anatomy/gen/build.ts — no editar a mano.\n' +
    `// Modelo anatómico propio (${sex === 'F' ? 'mujer' : 'hombre'}): esqueleto paramétrico, músculos por fibras y piel por\n` +
    '// campos de distancia, con las proporciones del motor (src/engine/anthropometry.ts).\n';
  const name = sex === 'F' ? 'F' : 'M';
  writeFileSync(
    out,
    header +
      `export const ANATOMY_${name}_MANIFEST = ${JSON.stringify(manifest)} as const;\n` +
      `export const ANATOMY_${name}_BIN = '${blob.toString('base64')}';\n`,
  );
  return { bytes: blob.byteLength, vertices: nv, triangles: ni / 3 };
}
