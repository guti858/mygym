/**
 * Genera el modelo anatómico propio de MyGym (hombre y mujer) sin recursos externos:
 *
 *   1. Esqueleto paramétrico en posición anatómica con las proporciones del motor (skeleton.ts).
 *   2. Núcleo profundo (hueso + musculatura profunda) como unión suave de primitivas SDF (body.ts).
 *   3. Músculos superficiales como láminas de fibras con sección elíptica, apilados por capas sobre
 *      el núcleo (muscles.ts + loft.ts).
 *   4. Piel: superficie a distancia «grasa» de la unión de núcleo y músculos, más cara y mamas;
 *      guantes, calzado, pelo y ojos (body.ts). Mallado con surface nets y simplificación QEM.
 *   5. Pesos de skinning respecto al rig del motor (weights.ts) y empaquetado (pack.ts).
 *
 * Uso: npx tsx scripts/anatomy/gen/build.ts [M|F ...]   (o npm run anatomy:build)
 */
import { fileURLToPath } from 'node:url';
import type { Sex } from '../../../src/engine/anthropometry';
import { boneShapes, coreParts, eyeShapes, handShapes, hairField, shoeShapes } from './body';
import { loftMuscle, type LoftMesh } from './loft';
import { area, simplify, surfaceNets, taubin, type Mesh } from './mesher';
import { muscleDefs } from './muscles';
import { writeModule, type Item } from './pack';
import { smoothstep, Union, type Field, type Shape, type V3 } from './sdf';
import { buildSkeleton } from './skeleton';
import { anchors, computeWeights, finalize, type WeightOpts } from './weights';

const t0 = Date.now();
const log = (...a: unknown[]) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s]`, ...a);

const mirrorShape = (s: Shape): Shape => ({ f: (x, y, z) => s.f(-x, y, z), lo: [-s.hi[0], s.lo[1], s.lo[2]], hi: [-s.lo[0], s.hi[1], s.hi[2]] });

function meshOf(f: Field, lo: V3, hi: V3, h: number): Mesh {
  return surfaceNets(f, lo, hi, h);
}

async function buildSex(sex: Sex) {
  const sk = buildSkeleton(sex);
  const { H, L, p } = sk;
  const c7y = L.c7![1];
  const cp = coreParts(sk);
  const coreUnion = new Union(cp.core, 0.018 * H);
  const core = coreUnion.f;
  const coreShape: Shape = { f: core, ...coreUnion.bounds };
  log(sex, 'esqueleto y núcleo');

  // --- Músculos por capas.
  const defs = muscleDefs(sk, core).sort((a, b) => a.layer - b.layer);
  const muscles: LoftMesh[] = [];
  const spheresL: Shape[] = [];
  const skinL: Shape[] = [];
  let underlay: Field = core;
  let layer = -1;
  for (const def of defs) {
    if (def.layer !== layer) {
      layer = def.layer;
      underlay = spheresL.length ? new Union([coreShape, ...spheresL], 0.012).f : core;
    }
    const r = loftMuscle(def, underlay);
    muscles.push(...r.pieces);
    spheresL.push(...r.spheres);
    skinL.push(...r.skinSpheres);
  }
  log(sex, `músculos: ${defs.length} definiciones, ${muscles.length} piezas`);

  // --- Piel: núcleo + músculos (ambos lados) + extras, desplazada por la grasa.
  const skinUnion = new Union([coreShape, ...spheresL, ...spheresL.map(mirrorShape), ...cp.skinExtras], 0.006 * H);
  const cuts = new Union(cp.skinCuts, 0);
  const skinField: Field = (x, y, z) => {
    let d = skinUnion.f(x, y, z) - cp.fat(x, y, z);
    d = Math.max(d, -cuts.f(x, y, z) + 0.0015 * H);
    return d;
  };
  const bb = skinUnion.bounds;
  const pad = 0.03;
  const lo: V3 = [bb.lo[0] - pad, Math.max(0.02, bb.lo[1]), bb.lo[2] - pad];
  const hi: V3 = [bb.hi[0] + pad, bb.hi[1] + pad, bb.hi[2] + pad];
  // La piel termina en muñecas y tobillos (dentro de guantes y calzado).
  const skinRaw = meshOf(skinField, lo, hi, 0.0085 * (H / 1.75));
  const skin = await simplify(taubin(skinRaw, 4), 11000, 0.0012);
  log(sex, `piel: ${skinRaw.T.length / 3} → ${skin.T.length / 3} triángulos, ${area(skin).toFixed(2)} m²`);

  // --- Núcleo visible (sin la cabeza, que tapa la piel opaca).
  const headCut = c7y + 0.05 * H;
  const coreVisible: Field = (x, y, z) => Math.max(core(x, y, z) + 0.001, y - headCut);
  const coreMesh = await simplify(taubin(meshOf(coreVisible, lo, hi, 0.009 * (H / 1.75)), 3), 4200, 0.002);
  log(sex, `núcleo: ${coreMesh.T.length / 3} triángulos`);

  // --- Manos, calzado, pelo, ojos y huesos visibles (lado izquierdo salvo el pelo).
  const handU = new Union(handShapes(sk), 0.004 * H);
  const hb = handU.bounds;
  const hand = await simplify(taubin(meshOf(handU.f, [hb.lo[0] - 0.01, hb.lo[1] - 0.01, hb.lo[2] - 0.01], [hb.hi[0] + 0.01, hb.hi[1] + 0.01, hb.hi[2] + 0.01], 0.0022), 3), 1800, 0.004);
  const shoe = shoeShapes(sk);
  const shoeU = new Union(shoe.shapes, 0.008);
  const sb = shoeU.bounds;
  const shoeF: Field = (x, y, z) => Math.max(shoeU.f(x, y, z), shoe.clip(x, y, z));
  const shoeMesh = await simplify(taubin(meshOf(shoeF, [sb.lo[0] - 0.015, -0.004, sb.lo[2] - 0.015], [sb.hi[0] + 0.015, sb.hi[1] + 0.015, sb.hi[2] + 0.015], 0.0032), 3), 1400, 0.0015);
  const headC = p.headC!;
  const hairF = hairField(sk, skinField);
  const hairMesh = await simplify(
    taubin(meshOf(hairF, [-0.11 * H, headC[1] - 0.09 * H, headC[2] - 0.13 * H], [0.11 * H, headC[1] + 0.09 * H, headC[2] + 0.09 * H], 0.0035), 3),
    2400,
    0.004,
  );
  const eyes = eyeShapes(sk);
  const eyeMesh = (s: Shape) => meshOf(s.f, [s.lo[0] - 0.003, s.lo[1] - 0.003, s.lo[2] - 0.003], [s.hi[0] + 0.003, s.hi[1] + 0.003, s.hi[2] + 0.003], 0.0016);
  const sclera = await simplify(eyeMesh(eyes.sclera), 160, 0.01);
  const iris = await simplify(eyeMesh(eyes.iris), 60, 0.01);
  const bones = await Promise.all(
    boneShapes(sk).map(async ({ name, shape }) => ({ name, mesh: await simplify(taubin(meshOf(shape.f, [shape.lo[0] - 0.006, shape.lo[1] - 0.006, shape.lo[2] - 0.006], [shape.hi[0] + 0.006, shape.hi[1] + 0.006, shape.hi[2] + 0.006], 0.0022), 2), 220, 0.004) })),
  );
  log(sex, `acabados: mano ${hand.T.length / 3}, calzado ${shoeMesh.T.length / 3}, pelo ${hairMesh.T.length / 3} triángulos`);

  // --- Pesos y empaquetado.
  const anc = anchors(sk);
  const items: Item[] = [];
  const add = (name: string, group_: string, kind: Item['kind'], mirror: boolean, m: Mesh, aux: Float32Array, w: WeightOpts) => {
    const W = computeWeights(sk, anc, m.P, m.T, w);
    const { idx, w: wq } = finalize(W, m.P.length / 3);
    items.push({ name, group: group_, kind, mirror, P: m.P, T: m.T, skinIndex: idx, skinWeight: wq, aux });
  };
  const L_ = ['axial', 'girdle.L', 'humerus.L', 'forearm.L', 'hand.L', 'thigh.L', 'h_kn.L', 'shank.L', 'foot.L'];
  for (const m of muscles) add(m.name, m.group, m.kind, true, { P: m.P, T: m.T }, m.bulge, { sigma: 0.012, both: false, allowed: L_ });
  for (const b of bones) add(b.name, 'hueso', 'bone', true, b.mesh, new Float32Array(b.mesh.P.length / 3), { sigma: 0.01, both: false, rigid: b.name === 'Rótula' ? 'h_kn.L' : 'girdle.L' });
  add('Capa profunda', 'profundo', 'core', false, coreMesh, new Float32Array(coreMesh.P.length / 3), { sigma: 0.012, both: true });
  // Piel: opaca en cabeza y cuello alto; translúcida en el resto (canal auxiliar).
  const veil = new Float32Array(skin.P.length / 3);
  for (let i = 0; i < veil.length; i++) veil[i] = smoothstep(c7y + 0.028 * H, c7y + 0.05 * H, skin.P[i * 3 + 1]!);
  add('Piel', 'piel', 'skin', false, skin, veil, { sigma: 0.011, both: true });
  add('Guante', 'guante', 'detail', true, hand, new Float32Array(hand.P.length / 3), {
    sigma: 0.003,
    both: false,
    allowed: ['forearm.L', 'hand.L', ...['i', 'm', 'r', 'p'].flatMap((f) => [1, 2, 3].map((j) => `${f}${j}.L`)), 't1.L', 't2.L'],
  });
  add('Calzado', 'calzado', 'detail', true, shoeMesh, new Float32Array(shoeMesh.P.length / 3), { sigma: 0.005, both: false, allowed: ['shank.L', 'foot.L'] });
  add('Pelo', 'pelo', 'detail', false, hairMesh, new Float32Array(hairMesh.P.length / 3), { sigma: 0.01, both: true, rigid: 'neck' });
  add('Ojo', 'ojo', 'detail', true, sclera, new Float32Array(sclera.P.length / 3), { sigma: 0.01, both: false, rigid: 'neck' });
  add('Iris', 'iris', 'detail', true, iris, new Float32Array(iris.P.length / 3), { sigma: 0.01, both: false, rigid: 'neck' });
  log(sex, 'pesos');

  const out = fileURLToPath(new URL(`../../../src/anatomy/data-${sex.toLowerCase()}.generated.ts`, import.meta.url));
  const landmarks = Object.fromEntries(['hjc', 'knee', 'ankle', 'heel', 'toe', 'gh', 'elbow', 'wrist', 'sc', ...['i', 'm', 'r', 'p'].flatMap((f) => [0, 1, 2, 3].map((j) => `${f}${j}`)), 't0', 't1', 't2', 's1', 'l1', 'c7', 'top'].map((k) => [k, L[k]!]));
  const r = writeModule(out, sex, items, landmarks);
  log(sex, `→ ${out}: ${items.length} piezas, ${r.vertices} vértices, ${r.triangles} triángulos, ${(r.bytes / 1024).toFixed(0)} KB`);
  const byGroup = new Map<string, number>();
  for (const it of items) byGroup.set(it.group, (byGroup.get(it.group) ?? 0) + it.T.length / 3);
  console.log([...byGroup].map(([g, t]) => `  ${g.padEnd(20)} ${t}`).join('\n'));
}

const sexes = (process.argv.slice(2).filter((a) => a === 'M' || a === 'F') as Sex[]).concat();
for (const sex of sexes.length ? sexes : (['M', 'F'] as Sex[])) await buildSex(sex);
