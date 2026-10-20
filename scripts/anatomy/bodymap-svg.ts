/**
 * Genera src/ui/bodymap.generated.ts: el mapa muscular 2D (SVG) del gimnasio a partir del
 * mismo modelo anatómico que usan las animaciones 3D (Z-Anatomy / BodyParts3D, postura de
 * referencia).
 *
 * Qué hace, para una proyección ortográfica frontal y otra dorsal:
 *   1. Construye el modelo (buildModel) y rasteriza todos los triángulos de todos los grupos en
 *      un búfer de identificadores con prueba de profundidad: cada píxel sabe qué grupo es el
 *      más cercano a la cámara (músculo del catálogo, otro músculo, hueso/tendón o piel).
 *   2. Limpia el búfer (islas diminutas y huecos se funden con su vecino dominante; filtro de
 *      moda 3×3 para quitar dientes de sierra).
 *   3. Extrae las fronteras entre regiones como cadenas de aristas de píxel compartidas
 *      (un grafo plano: las cadenas acaban en las esquinas donde se tocan 3 o más regiones),
 *      las suaviza y simplifica (Douglas–Peucker) una sola vez por cadena, de modo que dos
 *      regiones vecinas comparten exactamente el mismo borde (sin huecos ni solapes).
 *   4. Reconstruye los anillos de cada región con esas cadenas y los escribe como trazados SVG
 *      (fill-rule evenodd) en centímetros con un decimal.
 *
 * Ejes del modelo en reposo: X hacia la izquierda del sujeto, Y hacia arriba, Z anterior.
 * Vista frontal: la izquierda del sujeto queda a la derecha del observador; en la dorsal,
 * a la izquierda.
 *
 * Uso: npx tsx scripts/anatomy/bodymap-svg.ts   (o npm run anatomy:bodymap)
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ANATOMY_BIN, ANATOMY_MANIFEST } from '../../src/anatomy/data.generated';
import { buildModel, type AnatomyManifest } from '../../src/anatomy/model';
import { MUSCLE_IDS, MUSCLES, type MuscleId } from '../../src/content/muscles';

const OUT = fileURLToPath(new URL('../../src/ui/bodymap.generated.ts', import.meta.url));

/** Píxeles de raster por unidad del viewBox (1 unidad = 1 cm). */
const R = 8;
/** Margen alrededor de la figura (cm). */
const MARGIN = 1;
/** Área mínima (px) de una isla de una región; las menores se funden con su vecina. */
const MIN_AREA = 40;
/** Área máxima (px) de un hueco de fondo dentro del cuerpo que se rellena. */
const HOLE_AREA = 160;
/** Islas finas (grosor medio < THIN_WIDTH px) por debajo de este área (px) se funden también. */
const THIN_AREA = 400;
const THIN_WIDTH = 3;
/**
 * En la vista que no es la suya (MUSCLES[m].view) un músculo solo conserva las islas de al menos
 * este área (px): evita esquirlas que se ven «a través» del cuerpo (p. ej. el trapecio bajo la
 * barbilla en la vista frontal).
 */
const SECONDARY_MIN_AREA = 8 * R * R;
/** Islas de un músculo menores que esta fracción de su isla mayor (en la misma vista) se funden. */
const REL_MIN = 0.06;
/** Pasadas del filtro de moda 3×3. */
const MODE_PASSES = 2;
/** Iteraciones de suavizado de las cadenas (núcleo 1/4·1/2·1/4). */
const SMOOTH_ITERS = 3;
/** Tolerancia de Douglas–Peucker (px de raster). */
const DP_EPS = 0.7;

// ---------------------------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------------------------

const BASE = ['otros', 'hueso', 'piel'] as const;
type Base = (typeof BASE)[number];

/** 0 = fondo; 1..n = músculos del catálogo; después, las partes de base. */
const LABELS: readonly string[] = ['', ...MUSCLE_IDS, ...BASE];
const LABEL_OF = new Map(LABELS.map((l, i) => [l, i]));
const GROUP_TO_BASE: Record<string, Base> = {
  otros: 'otros',
  tendon: 'hueso',
  hueso: 'hueso',
  piel: 'piel',
  guante: 'piel',
  calzado: 'piel',
  ojo: 'piel',
  iris: 'piel',
};
/** Grupos que no se dibujan: el pelo daría a la cabeza un contorno deshilachado. */
const SKIP_GROUPS = new Set(['pelo']);

function labelOfGroup(group: string): number {
  const direct = LABEL_OF.get(group);
  if (direct !== undefined && direct > 0) return direct;
  const base = GROUP_TO_BASE[group];
  if (!base) {
    console.warn(`Grupo desconocido «${group}»: se pinta como «otros».`);
    return LABEL_OF.get('otros')!;
  }
  return LABEL_OF.get(base)!;
}

// ---------------------------------------------------------------------------------------------
// Modelo y encuadre
// ---------------------------------------------------------------------------------------------

const model = buildModel(ANATOMY_MANIFEST as unknown as AnatomyManifest, ANATOMY_BIN);

let xAbs = 0;
let yMin = Infinity;
let yMax = -Infinity;
for (const geo of model.geometries.values()) {
  const P = geo.getAttribute('position').array as Float32Array;
  for (let i = 0; i < P.length; i += 3) {
    xAbs = Math.max(xAbs, Math.abs(P[i]!));
    yMin = Math.min(yMin, P[i + 1]!);
    yMax = Math.max(yMax, P[i + 1]!);
  }
}
const VW = Math.ceil(2 * xAbs * 100 + 2 * MARGIN);
const VH = Math.ceil((yMax - yMin) * 100 + 2 * MARGIN);
const W = VW * R;
const H = VH * R;

type View = 'front' | 'back';

// ---------------------------------------------------------------------------------------------
// 1. Rasterización con búfer de profundidad
// ---------------------------------------------------------------------------------------------

function rasterize(view: View): Uint8Array {
  const s = view === 'front' ? 1 : -1;
  const lab = new Uint8Array(W * H);
  const depth = new Float32Array(W * H).fill(-Infinity);
  // Orden estable de grupos (el de la geometría) para que el resultado sea determinista.
  for (const [group, geo] of model.geometries) {
    if (SKIP_GROUPS.has(group)) continue;
    const L = labelOfGroup(group);
    const P = geo.getAttribute('position').array as Float32Array;
    const I = geo.getIndex()!.array;
    const n = P.length / 3;
    const X = new Float64Array(n);
    const Y = new Float64Array(n);
    const Z = new Float64Array(n);
    for (let v = 0; v < n; v++) {
      X[v] = (VW / 2 + s * P[v * 3]! * 100) * R;
      Y[v] = (MARGIN + (yMax - P[v * 3 + 1]!) * 100) * R;
      Z[v] = s * P[v * 3 + 2]!;
    }
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t]!;
      const b = I[t + 1]!;
      const c = I[t + 2]!;
      const ax = X[a]!, ay = Y[a]!, bx = X[b]!, by = Y[b]!, cx = X[c]!, cy = Y[c]!;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5));
      const x1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5));
      const y1 = Math.min(H - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
      const za = Z[a]!, zb = Z[b]!, zc = Z[c]!;
      for (let py = y0; py <= y1; py++) {
        const qy = py + 0.5;
        for (let px = x0; px <= x1; px++) {
          const qx = px + 0.5;
          const w0 = ((bx - qx) * (cy - qy) - (by - qy) * (cx - qx)) / area;
          const w1 = ((cx - qx) * (ay - qy) - (cy - qy) * (ax - qx)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
          const z = w0 * za + w1 * zb + w2 * zc;
          const k = py * W + px;
          if (z > depth[k]!) {
            depth[k] = z;
            lab[k] = L;
          }
        }
      }
    }
  }
  return lab;
}

// ---------------------------------------------------------------------------------------------
// 2. Limpieza del búfer
// ---------------------------------------------------------------------------------------------

interface Components {
  id: Int32Array;
  label: number[];
  area: number[];
  /** Aristas de píxel en el contorno de la isla. */
  perimeter: number[];
  border: boolean[];
}

function components(lab: Uint8Array): Components {
  const id = new Int32Array(W * H).fill(-1);
  const label: number[] = [];
  const area: number[] = [];
  const perimeter: number[] = [];
  const border: boolean[] = [];
  const stack = new Int32Array(W * H);
  for (let start = 0; start < W * H; start++) {
    if (id[start]! >= 0) continue;
    const c = label.length;
    const L = lab[start]!;
    let top = 0;
    let n = 0;
    let per = 0;
    let onBorder = false;
    stack[top++] = start;
    id[start] = c;
    while (top > 0) {
      const k = stack[--top]!;
      n++;
      const x = k % W;
      const y = (k - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) onBorder = true;
      per += +(x === 0 || lab[k - 1] !== L) + +(x === W - 1 || lab[k + 1] !== L) + +(y === 0 || lab[k - W] !== L) + +(y === H - 1 || lab[k + W] !== L);
      for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) {
        if (j < 0 || id[j]! >= 0 || lab[j] !== L) continue;
        id[j] = c;
        stack[top++] = j;
      }
    }
    label.push(L);
    area.push(n);
    perimeter.push(per);
    border.push(onBorder);
  }
  return { id, label, area, perimeter, border };
}

/** Funde con su vecino dominante las islas que `drop` marca, hasta que no quede ninguna. */
function mergeComponents(lab: Uint8Array, drop: (comp: Components, c: number, largest: number[]) => boolean): void {
  for (let iter = 0; iter < 30; iter++) {
    const comp = components(lab);
    const largest = new Array<number>(LABELS.length).fill(0);
    comp.label.forEach((L, c) => (largest[L] = Math.max(largest[L]!, comp.area[c]!)));
    const small = comp.label.map((_, c) => drop(comp, c, largest));
    if (!small.some(Boolean)) return;
    // Recuento de etiquetas vecinas a lo largo del borde de cada isla pequeña.
    const counts = new Map<number, Map<number, number>>();
    for (let k = 0; k < W * H; k++) {
      const c = comp.id[k]!;
      if (!small[c]) continue;
      const x = k % W;
      let m = counts.get(c);
      if (!m) counts.set(c, (m = new Map()));
      for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (j < 0 || j >= W * H || comp.id[j] === c) continue;
        const L = lab[j]!;
        m.set(L, (m.get(L) ?? 0) + 1);
      }
    }
    const target = new Map<number, number>();
    for (const [c, m] of counts) {
      let best = -1;
      let bestN = -1;
      for (const [L, n] of [...m].sort((p, q) => p[0] - q[0])) {
        if (n <= bestN) continue;
        best = L;
        bestN = n;
      }
      if (best >= 0) target.set(c, best);
    }
    for (let k = 0; k < W * H; k++) {
      const t = target.get(comp.id[k]!);
      if (t !== undefined) lab[k] = t;
    }
  }
}

/** Filtro de moda 3×3: un píxel adopta la etiqueta mayoritaria (≥ 5 de 9) de su entorno. */
function modeFilter(lab: Uint8Array): Uint8Array {
  const out = lab.slice();
  const vals = new Int32Array(9);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) vals[n++] = lab[k + dy * W + dx]!;
      let best = lab[k]!;
      let bestN = 0;
      for (let i = 0; i < 9; i++) {
        let c = 0;
        for (let j = 0; j < 9; j++) if (vals[j] === vals[i]) c++;
        if (c < bestN || (c === bestN && vals[i]! >= best)) continue;
        bestN = c;
        best = vals[i]!;
      }
      if (bestN >= 5) out[k] = best;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// 3. Grafo de fronteras: cadenas compartidas entre regiones
// ---------------------------------------------------------------------------------------------
// Esquinas de píxel c = y·(W+1) + x. Aristas horizontales h(x,y): (x,y)→(x+1,y), separan el
// píxel (x,y−1) del (x,y). Verticales v(x,y): (x,y)→(x,y+1), separan (x−1,y) de (x,y).

const CW = W + 1;
const NH = (H + 1) * W;
const NV = H * CW;

interface Chain {
  /** Esquinas recorridas (índices); en una cadena cerrada la primera no se repite al final. */
  corners: number[];
  closed: boolean;
  /** Etiqueta a la derecha / izquierda al recorrerla hacia delante (y hacia abajo en pantalla). */
  right: number;
  left: number;
  /** Puntos suavizados y simplificados (px), en sentido directo; cerrada: sin repetir el primero. */
  pts: Array<[number, number]>;
}

function buildChains(lab: Uint8Array): Chain[] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : lab[y * W + x]!);
  const isB = new Uint8Array(NH + NV);
  for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) if (at(x, y - 1) !== at(x, y)) isB[y * W + x] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x <= W; x++) if (at(x - 1, y) !== at(x, y)) isB[NH + y * CW + x] = 1;

  /** Aristas frontera que tocan la esquina (x,y). */
  const incident = (c: number): number[] => {
    const x = c % CW;
    const y = (c - x) / CW;
    const out: number[] = [];
    if (x < W && isB[y * W + x]) out.push(y * W + x);
    if (x > 0 && isB[y * W + x - 1]) out.push(y * W + x - 1);
    if (y < H && isB[NH + y * CW + x]) out.push(NH + y * CW + x);
    if (y > 0 && isB[NH + (y - 1) * CW + x]) out.push(NH + (y - 1) * CW + x);
    return out;
  };
  const ends = (e: number): [number, number] => {
    if (e < NH) {
      const x = e % W;
      const y = (e - x) / W;
      return [y * CW + x, y * CW + x + 1];
    }
    const k = e - NH;
    return [k, k + CW];
  };
  /** Etiquetas a derecha e izquierda al recorrer e desde la esquina p. */
  const sides = (e: number, p: number): [number, number] => {
    let r: number;
    let l: number;
    if (e < NH) {
      const x = e % W;
      const y = (e - x) / W;
      [r, l] = [at(x, y), at(x, y - 1)]; // hacia +x: derecha = abajo
    } else {
      const k = e - NH;
      const x = k % CW;
      const y = (k - x) / CW;
      [r, l] = [at(x - 1, y), at(x, y)]; // hacia +y: derecha = −x
    }
    return ends(e)[0] === p ? [r, l] : [l, r];
  };

  const used = new Uint8Array(NH + NV);
  const chains: Chain[] = [];
  const walk = (start: number, first: number, closedLoop: boolean) => {
    const corners = [start];
    const [right, left] = sides(first, start);
    let e = first;
    let cur = start;
    for (;;) {
      used[e] = 1;
      const [a, b] = ends(e);
      const next = a === cur ? b : a;
      if (closedLoop && next === start) break;
      corners.push(next);
      const inc = incident(next);
      if (!closedLoop && inc.length !== 2) break;
      const other = inc.find((f) => f !== e);
      if (other === undefined || used[other]) break;
      e = other;
      cur = next;
    }
    chains.push({ corners, closed: closedLoop, right, left, pts: [] });
  };

  // Cadenas abiertas: desde cada esquina de unión (grado ≠ 2).
  for (let c = 0; c < CW * (H + 1); c++) {
    const inc = incident(c);
    if (inc.length === 0 || inc.length === 2) continue;
    for (const e of inc) if (!used[e]) walk(c, e, false);
  }
  // Ciclos sin uniones (islas rodeadas por una sola región).
  for (let e = 0; e < NH + NV; e++) if (isB[e] && !used[e]) walk(ends(e)[0], e, true);

  for (const ch of chains) ch.pts = simplifyChain(ch);
  return chains;
}

function cornerXY(c: number): [number, number] {
  const x = c % CW;
  return [x, (c - x) / CW];
}

function smooth(P: Array<[number, number]>, closed: boolean): Array<[number, number]> {
  let cur = P;
  const n = P.length;
  if (n < 3) return P;
  for (let it = 0; it < SMOOTH_ITERS; it++) {
    const next = cur.map((p) => [p[0], p[1]] as [number, number]);
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const a = cur[(i - 1 + n) % n]!;
      const b = cur[i]!;
      const c = cur[(i + 1) % n]!;
      next[i] = [0.25 * a[0] + 0.5 * b[0] + 0.25 * c[0], 0.25 * a[1] + 0.5 * b[1] + 0.25 * c[1]];
    }
    cur = next;
  }
  return cur;
}

function douglasPeucker(P: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (P.length <= 2) return P;
  const keep = new Uint8Array(P.length);
  keep[0] = keep[P.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, P.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    const [ax, ay] = P[i0]!;
    const [bx, by] = P[i1]!;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let best = -1;
    let bestD = eps;
    for (let i = i0 + 1; i < i1; i++) {
      const [px, py] = P[i]!;
      const d = len > 1e-12 ? Math.abs(dx * (py - ay) - dy * (px - ax)) / len : Math.hypot(px - ax, py - ay);
      if (d <= bestD) continue;
      bestD = d;
      best = i;
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([i0, best], [best, i1]);
    }
  }
  return P.filter((_, i) => keep[i]);
}

function simplifyChain(ch: Chain): Array<[number, number]> {
  const P = smooth(ch.corners.map(cornerXY), ch.closed);
  if (!ch.closed) return douglasPeucker(P, DP_EPS);
  // Anillo: se parte por el primer punto y el más lejano a él.
  let far = 0;
  let farD = -1;
  for (let i = 0; i < P.length; i++) {
    const d = Math.hypot(P[i]![0] - P[0]![0], P[i]![1] - P[0]![1]);
    if (d <= farD) continue;
    farD = d;
    far = i;
  }
  const a = douglasPeucker(P.slice(0, far + 1), DP_EPS);
  const b = douglasPeucker([...P.slice(far), P[0]!], DP_EPS);
  return [...a, ...b.slice(1, -1)];
}

// ---------------------------------------------------------------------------------------------
// 4. Anillos de cada región y trazados SVG
// ---------------------------------------------------------------------------------------------

/** Píxel a la derecha de la arista p→q (esquinas). */
function rightPixel(p: number, q: number): number {
  const [px, py] = cornerXY(p);
  const [qx, qy] = cornerXY(q);
  const dx = qx - px;
  const dy = qy - py;
  const cx = Math.floor((px + qx) / 2 - 0.5 * dy);
  const cy = Math.floor((py + qy) / 2 + 0.5 * dx);
  return cy * W + cx;
}

interface Oriented {
  chain: Chain;
  forward: boolean;
  start: number;
  end: number;
  startPix: number;
  endPix: number;
}

/** Anillos (en px) del conjunto de píxeles cuyas etiquetas cumplen `inside`. */
function rings(chains: Chain[], inside: (label: number) => boolean): Array<Array<[number, number]>> {
  const out: Array<Array<[number, number]>> = [];
  const open: Oriented[] = [];
  for (const ch of chains) {
    const r = inside(ch.right);
    if (r === inside(ch.left)) continue;
    if (ch.closed) {
      out.push(r ? ch.pts : [...ch.pts].reverse());
      continue;
    }
    const C = r ? ch.corners : [...ch.corners].reverse();
    open.push({
      chain: ch,
      forward: r,
      start: C[0]!,
      end: C[C.length - 1]!,
      startPix: rightPixel(C[0]!, C[1]!),
      endPix: rightPixel(C[C.length - 2]!, C[C.length - 1]!),
    });
  }
  const byStart = new Map<number, Oriented[]>();
  for (const o of open) {
    const list = byStart.get(o.start) ?? [];
    list.push(o);
    byStart.set(o.start, list);
  }
  const done = new Set<Oriented>();
  for (const first of open) {
    if (done.has(first)) continue;
    const ring: Array<[number, number]> = [];
    let cur = first;
    for (let guard = 0; guard < open.length + 1; guard++) {
      done.add(cur);
      const pts = cur.forward ? cur.chain.pts : [...cur.chain.pts].reverse();
      ring.push(...pts.slice(0, -1));
      const cands = byStart.get(cur.end) ?? [];
      const endPix = cur.endPix;
      const next = cands.length === 1 ? cands[0] : (cands.find((o) => o.startPix === endPix) ?? cands.find((o) => !done.has(o)));
      if (!next || next === first || done.has(next)) break;
      cur = next;
    }
    out.push(ring);
  }
  return out;
}

/** Número en décimas → texto compacto («.5», «-1.2», «3»). */
function num(t: number): string {
  const s = t < 0 ? '-' : '';
  const a = Math.abs(t);
  const i = Math.floor(a / 10);
  const f = a % 10;
  return s + (f === 0 ? String(i) : `${i === 0 ? '' : i}.${f}`);
}

function joinNums(nums: string[]): string {
  let out = '';
  let prev = '';
  for (const n of nums) {
    if (prev === '' || n.startsWith('-') || (n.startsWith('.') && prev.includes('.'))) out += n;
    else out += ` ${n}`;
    prev = n;
  }
  return out;
}

/** Anillos en px → trazado SVG (M absoluto + l relativo en décimas exactas). */
function toPath(rs: Array<Array<[number, number]>>): string {
  const parts: string[] = [];
  for (const ring of rs) {
    const T: Array<[number, number]> = [];
    for (const [x, y] of ring) {
      const p: [number, number] = [Math.round((x / R) * 10), Math.round((y / R) * 10)];
      const last = T[T.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) T.push(p);
    }
    while (T.length > 1 && T[0]![0] === T[T.length - 1]![0] && T[0]![1] === T[T.length - 1]![1]) T.pop();
    if (T.length < 3) continue;
    let a2 = 0;
    for (let i = 0; i < T.length; i++) {
      const p = T[i]!;
      const q = T[(i + 1) % T.length]!;
      a2 += p[0] * q[1] - q[0] * p[1];
    }
    if (Math.abs(a2) / 2 < 4) continue; // < 0.04 cm²
    const rel: string[] = [];
    for (let i = 1; i < T.length; i++) rel.push(num(T[i]![0] - T[i - 1]![0]), num(T[i]![1] - T[i - 1]![1]));
    parts.push(`M${joinNums([num(T[0]![0]), num(T[0]![1])])}l${joinNums(rel)}z`);
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------------------------

interface ViewOut {
  silhouette: string;
  base: Partial<Record<Base, string>>;
  regions: Partial<Record<MuscleId, string>>;
  area: Partial<Record<MuscleId, number>>;
}

/** Islas diminutas o finas y huecos de fondo interiores. */
const isNoise = (comp: Components, c: number): boolean => {
  const a = comp.area[c]!;
  if (comp.label[c] === 0) return !comp.border[c] && a < HOLE_AREA;
  return a < MIN_AREA || (a < THIN_AREA && (2 * a) / comp.perimeter[c]! < THIN_WIDTH);
};

function buildView(view: View): ViewOut {
  let lab = rasterize(view);
  mergeComponents(lab, isNoise);
  for (let i = 0; i < MODE_PASSES; i++) lab = modeFilter(lab);
  const primary = (L: number) => MUSCLES[LABELS[L] as MuscleId].view === (view === 'front' ? 'anterior' : 'posterior');
  mergeComponents(lab, (comp, c, largest) => {
    if (isNoise(comp, c)) return true;
    const L = comp.label[c]!;
    if (L === 0 || L > MUSCLE_IDS.length) return false;
    const a = comp.area[c]!;
    return a < REL_MIN * largest[L]! || (!primary(L) && a < SECONDARY_MIN_AREA);
  });
  const chains = buildChains(lab);
  const hist = new Uint32Array(LABELS.length);
  for (const L of lab) hist[L]!++;
  const out: ViewOut = { silhouette: toPath(rings(chains, (L) => L !== 0)), base: {}, regions: {}, area: {} };
  for (const b of BASE) {
    const L = LABEL_OF.get(b)!;
    if (hist[L]) out.base[b] = toPath(rings(chains, (x) => x === L));
  }
  for (const m of MUSCLE_IDS) {
    const L = LABEL_OF.get(m)!;
    if (!hist[L]) continue;
    const d = toPath(rings(chains, (x) => x === L));
    if (d) {
      out.regions[m] = d;
      out.area[m] = hist[L]! / (R * R);
    }
  }
  return out;
}

const views = { front: buildView('front'), back: buildView('back') };

const strip = (v: ViewOut) => ({ silhouette: v.silhouette, base: v.base, regions: v.regions });
const body = `// Generado por scripts/anatomy/bodymap-svg.ts (npm run anatomy:bodymap) — no editar a mano.
// Proyecciones frontal y dorsal del modelo anatómico de src/anatomy (derivado de Z-Anatomy,
// CC BY-SA 4.0, https://www.z-anatomy.com, basado en BodyParts3D, © The Database Center for
// Life Science, CC BY-SA 2.1 Japan). Este fichero se distribuye bajo CC BY-SA 4.0.
// Unidades: centímetros. Vista frontal: la izquierda del sujeto queda a la derecha del dibujo.
import type { MuscleId } from '../content/muscles';

/** Partes visibles que no son músculos seleccionables. */
export type BodyMapBase = ${BASE.map((b) => `'${b}'`).join(' | ')};

export interface BodyMapViewPaths {
  /** Contorno de todo el cuerpo (unión de todas las partes). */
  silhouette: string;
  /** Otros músculos, huesos y tendones, y piel de cabeza, manos y pies. */
  base: Partial<Record<BodyMapBase, string>>;
  /** Región visible de cada músculo del catálogo (ambos lados). */
  regions: Partial<Record<MuscleId, string>>;
}

export const BODYMAP: { viewBox: string; width: number; height: number; front: BodyMapViewPaths; back: BodyMapViewPaths } = ${JSON.stringify(
  { viewBox: `0 0 ${VW} ${VH}`, width: VW, height: VH, front: strip(views.front), back: strip(views.back) },
  null,
  2,
)};
`;
writeFileSync(OUT, body);

// Informe
const fmt = (n: number | undefined) => (n === undefined ? '—' : n.toFixed(1).padStart(6));
console.log(`viewBox 0 0 ${VW} ${VH} · raster ${W}×${H}`);
console.log('músculo               frente  espalda  (cm² visibles)');
const missing: MuscleId[] = [];
for (const m of MUSCLE_IDS) {
  const f = views.front.area[m];
  const b = views.back.area[m];
  if (f === undefined && b === undefined) missing.push(m);
  console.log(`${m.padEnd(22)}${fmt(f).padStart(6)}  ${fmt(b).padStart(6)}`);
}
if (missing.length) console.warn(`Sin región visible en ninguna vista: ${missing.join(', ')}`);
console.log(`${OUT}: ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
