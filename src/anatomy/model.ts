import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three';
import type { Sex } from '../engine/anthropometry';
import { decodeBase64, whenIdle } from '../scene/base64';
import type { Landmarks } from './rig';

/** Manifiesto del modelo anatómico generado (ver scripts/anatomy/gen/build.ts). */
export interface AnatomyManifest {
  sex: Sex;
  bones: readonly string[];
  bbox: readonly [readonly number[], readonly number[]];
  layout: Readonly<Record<'position' | 'index' | 'skinIndex' | 'skinWeight' | 'aux', readonly [number, number]>>;
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
  /** Grupo de cada región (índice del atributo `region` del cuerpo). */
  regions: readonly string[];
  /** Todo lo opaco en una sola geometría con skinning: músculos, tendones, capa profunda, huesos, guantes, calzado, pelo y ojos. */
  body: BufferGeometry;
  /** La piel (translúcida salvo la cabeza: atributo `aux`). */
  skin: BufferGeometry;
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

type Obj = AnatomyManifest['objects'][number];

/**
 * Decodifica el binario y monta las dos geometrías. Las piezas reflejadas se duplican con los
 * huesos .L ↔ .R intercambiados y los triángulos invertidos.
 */
export function buildModel(manifest: AnatomyManifest, binB64: string): AnatomyModel {
  const bin = decodeBase64(binB64);
  const { layout } = manifest;
  const pos = new Uint16Array(bin.buffer, bin.byteOffset + layout.position[0], layout.position[1] / 2);
  const idx = new Uint16Array(bin.buffer, bin.byteOffset + layout.index[0], layout.index[1] / 2);
  const sIdx = bin.subarray(layout.skinIndex[0], layout.skinIndex[0] + layout.skinIndex[1]);
  const sW = bin.subarray(layout.skinWeight[0], layout.skinWeight[0] + layout.skinWeight[1]);
  const aux = bin.subarray(layout.aux[0], layout.aux[0] + layout.aux[1]);
  const [lo, hi] = manifest.bbox;
  const scale = [0, 1, 2].map((k) => (hi[k]! - lo[k]!) / 65535);
  const mirror = mirrorMap(manifest.bones);

  const regions: string[] = [];
  const regionOf = new Map<string, number>();
  for (const o of manifest.objects) {
    if (o.group === 'piel' || regionOf.has(o.group)) continue;
    regionOf.set(o.group, regions.length);
    regions.push(o.group);
  }

  const assemble = (objs: readonly Obj[], withRegion: boolean): BufferGeometry => {
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
    const AX = new Uint8Array(nv);
    const RG = withRegion ? new Uint8Array(nv) : null;
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0;
    let io = 0;
    for (const o of objs) {
      const region = regionOf.get(o.group) ?? 0;
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
          AX[vo + v] = aux[v0 + v]!;
          if (RG) RG[vo + v] = region;
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
    geo.setAttribute('aux', new BufferAttribute(AX, 1, true));
    if (RG) geo.setAttribute('region', new BufferAttribute(RG, 1));
    geo.setIndex(I instanceof Uint32Array ? new Uint32BufferAttribute(I, 1) : new Uint16BufferAttribute(I, 1));
    geo.computeVertexNormals();
    return geo;
  };

  const skinObjs = manifest.objects.filter((o) => o.group === 'piel');
  const bodyObjs = manifest.objects.filter((o) => o.group !== 'piel');
  return { manifest, regions, body: assemble(bodyObjs, true), skin: assemble(skinObjs, false) };
}

interface ModelModule {
  manifest: AnatomyManifest;
  bin: string;
}

const LOADERS: Record<Sex, () => Promise<ModelModule>> = {
  M: () => import('./data-m.generated').then((m) => ({ manifest: m.ANATOMY_M_MANIFEST as unknown as AnatomyManifest, bin: m.ANATOMY_M_BIN })),
  F: () => import('./data-f.generated').then((m) => ({ manifest: m.ANATOMY_F_MANIFEST as unknown as AnatomyManifest, bin: m.ANATOMY_F_BIN })),
};

const cache: Partial<Record<Sex, AnatomyModel>> = {};
const pending: Partial<Record<Sex, Promise<AnatomyModel>>> = {};
let first: Promise<unknown> | null = null;
const listeners = new Set<() => void>();

/**
 * Carga diferida del modelo de un sexo (cada binario va en su propio fragmento del bundle y solo
 * se descarga el que se usa).
 */
export function loadAnatomy(sex: Sex): Promise<AnatomyModel> {
  const done = cache[sex];
  if (done) return Promise.resolve(done);
  // Con el navegador libre: la evaluación y la decodificación no caen encima de los primeros fotogramas.
  const p = (pending[sex] ??= whenIdle()
    .then(LOADERS[sex])
    .then(({ manifest, bin }) => {
      const model = buildModel(manifest, bin);
      cache[sex] = model;
      for (const l of listeners) l();
      return model;
    }));
  first ??= p;
  return p;
}

/** Resuelve cuando ha terminado (o fallado) la primera carga de un modelo, sea del sexo que sea. */
export function anatomySettled(): Promise<void> {
  return (first ?? Promise.resolve()).then(
    () => undefined,
    () => undefined,
  );
}

export function getAnatomy(sex: Sex): AnatomyModel | null {
  return cache[sex] ?? null;
}

export function subscribeAnatomy(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
