import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three';
import type { Landmarks } from './rig';

/** Manifiesto del modelo anatómico exportado (ver scripts/anatomy/export_zanatomy.py). */
export interface AnatomyManifest {
  bones: readonly string[];
  bbox: readonly [readonly number[], readonly number[]];
  layout: Readonly<Record<'position' | 'index' | 'skinIndex' | 'skinWeight', readonly [number, number]>>;
  landmarks: Landmarks;
  objects: ReadonlyArray<{
    name: string;
    group: string;
    kind: string;
    /** Pieza del lado izquierdo que se refleja para obtener el derecho. */
    mirror: boolean;
    v: readonly [number, number];
    i: readonly [number, number];
  }>;
}

export interface AnatomyModel {
  manifest: AnatomyManifest;
  /** Una geometría con skinning por grupo de render (músculo del catálogo, huesos, piel...). */
  geometries: Map<string, BufferGeometry>;
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Índice del hueso simétrico (.L ↔ .R); los axiales se mantienen. */
function mirrorMap(bones: readonly string[]): Uint16Array {
  const idx = new Map(bones.map((b, i) => [b, i]));
  return Uint16Array.from(bones, (b, i) => {
    if (b.endsWith('.L')) return idx.get(`${b.slice(0, -2)}.R`) ?? i;
    if (b.endsWith('.R')) return idx.get(`${b.slice(0, -2)}.L`) ?? i;
    return i;
  });
}

export function buildModel(manifest: AnatomyManifest, binB64: string): AnatomyModel {
  const bin = decodeBase64(binB64);
  const { layout } = manifest;
  const pos = new Uint16Array(bin.buffer, bin.byteOffset + layout.position[0], layout.position[1] / 2);
  const idx = new Uint16Array(bin.buffer, bin.byteOffset + layout.index[0], layout.index[1] / 2);
  const sIdx = bin.subarray(layout.skinIndex[0], layout.skinIndex[0] + layout.skinIndex[1]);
  const sW = bin.subarray(layout.skinWeight[0], layout.skinWeight[0] + layout.skinWeight[1]);
  const [lo, hi] = manifest.bbox;
  const scale = [0, 1, 2].map((k) => (hi[k]! - lo[k]!) / 65535);
  const mirror = mirrorMap(manifest.bones);

  const byGroup = new Map<string, AnatomyManifest['objects'][number][]>();
  for (const o of manifest.objects) {
    const list = byGroup.get(o.group) ?? [];
    list.push(o);
    byGroup.set(o.group, list);
  }

  const geometries = new Map<string, BufferGeometry>();
  for (const [group, objs] of byGroup) {
    let nv = 0;
    let ni = 0;
    for (const o of objs) {
      const copies = o.mirror ? 2 : 1;
      nv += o.v[1] * copies;
      ni += o.i[1] * copies;
    }
    const P = new Float32Array(nv * 3);
    const SI = new Uint16Array(nv * 4);
    const SW = new Uint8Array(nv * 4);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0;
    let io = 0;
    for (const o of objs) {
      for (let copy = 0; copy < (o.mirror ? 2 : 1); copy++) {
        const sx = copy === 1 ? -1 : 1;
        const [v0, vc] = o.v;
        for (let v = 0; v < vc; v++) {
          const src = (v0 + v) * 3;
          const dst = (vo + v) * 3;
          P[dst] = sx * (lo[0]! + pos[src]! * scale[0]!);
          P[dst + 1] = lo[1]! + pos[src + 1]! * scale[1]!;
          P[dst + 2] = lo[2]! + pos[src + 2]! * scale[2]!;
          for (let k = 0; k < 4; k++) {
            const b = sIdx[(v0 + v) * 4 + k]!;
            SI[(vo + v) * 4 + k] = copy === 1 ? mirror[b]! : b;
            SW[(vo + v) * 4 + k] = sW[(v0 + v) * 4 + k]!;
          }
        }
        const [i0, ic] = o.i;
        for (let t = 0; t < ic; t += 3) {
          const a = idx[i0 + t]! + vo;
          const b = idx[i0 + t + 1]! + vo;
          const c = idx[i0 + t + 2]! + vo;
          // El reflejo invierte la orientación de los triángulos.
          I[io + t] = a;
          I[io + t + 1] = copy === 1 ? c : b;
          I[io + t + 2] = copy === 1 ? b : c;
        }
        vo += vc;
        io += ic;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(P, 3));
    geo.setAttribute('skinIndex', new Uint16BufferAttribute(SI, 4));
    geo.setAttribute('skinWeight', new BufferAttribute(SW, 4, true));
    geo.setIndex(I instanceof Uint32Array ? new Uint32BufferAttribute(I, 1) : new Uint16BufferAttribute(I, 1));
    geo.computeVertexNormals();
    geometries.set(group, geo);
  }
  return { manifest, geometries };
}

let cache: AnatomyModel | null = null;
let pending: Promise<AnatomyModel> | null = null;
const listeners = new Set<() => void>();

/** Carga diferida del modelo (el binario va en un fragmento aparte del bundle). */
export function loadAnatomy(): Promise<AnatomyModel> {
  if (cache) return Promise.resolve(cache);
  pending ??= import('./data.generated').then((m) => {
    cache = buildModel(m.ANATOMY_MANIFEST as unknown as AnatomyManifest, m.ANATOMY_BIN);
    for (const l of listeners) l();
    return cache;
  });
  return pending;
}

export function getAnatomy(): AnatomyModel | null {
  return cache;
}

export function subscribeAnatomy(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
