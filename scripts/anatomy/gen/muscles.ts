import type { MuscleDef, Station } from './loft';
import { cylDir, type Skeleton } from './skeleton';
import { add, lerp3, project, rayHit, type Field, type V3 } from './sdf';

/**
 * Músculos superficiales (lado izquierdo). Cada uno es una lámina de fibras: estaciones del
 * origen a la inserción, con su semigrosor. Los puntos se dan sobre el núcleo:
 *  - F(y, x) / B(y, x): cara anterior / posterior del tronco a la altura y, a x del centro;
 *  - T(y, ángulo): contorno del tronco a la altura y (0° delante, 90° lateral, 180° detrás);
 *  - Lp(segmento, t, ángulo): superficie de un segmento del miembro (t del proximal al distal;
 *    0° anterior —palma en el antebrazo—, 90° lateral —radial—, 180° posterior, 270° medial);
 *  - on(p): un punto anatómico llevado a la superficie.
 * Las capas ordenan el apilado: cada músculo se apoya en el núcleo y en las capas anteriores.
 */
export function muscleDefs(sk: Skeleton, core: Field): MuscleDef[] {
  const { H, L, p, limbs } = sk;
  const F = sk.sex === 'F';
  const kU = (F ? 0.78 : 1) * (H / 1.75);
  const kL = (F ? 0.92 : 1) * (H / 1.75);
  const kT = (kU + kL) / 2;
  const c7y = L.c7![1];
  const l1y = L.l1![1];
  const s1y = L.s1![1];
  const yHip = L.hjc![1];
  const gh = L.gh!;
  const headC = p.headC!;

  const on = (q: V3): V3 => project(core, q, 0);
  const F_ = (y: number, x: number): V3 => rayHit(core, [x, y, -0.02 * H], [0, 0, 1]);
  const B = (y: number, x: number): V3 => rayHit(core, [x, y, -0.02 * H], [0, 0, -1]);
  const T = (y: number, ang: number): V3 => {
    const a = (ang * Math.PI) / 180;
    return rayHit(core, [0, y, -0.015 * H], [Math.sin(a), 0, Math.cos(a)]);
  };
  // Cuello: rayos desde su eje.
  const neckA: V3 = [0, c7y - 0.012 * H, L.c7![2] + 0.03 * H];
  const neckB: V3 = [0, headC[1] - 0.045 * H, headC[2] - 0.004 * H];
  const N_ = (y: number, ang: number): V3 => {
    const t = (y - neckA[1]) / (neckB[1] - neckA[1]);
    const o = lerp3(neckA, neckB, t);
    const a = (ang * Math.PI) / 180;
    return rayHit(core, o, [Math.sin(a), 0, Math.cos(a)]);
  };
  type LimbName = keyof Skeleton['limbs'];
  const Lp = (l: LimbName, t: number, ang: number): V3 => rayHit(core, lerp3(limbs[l].a, limbs[l].b, t), cylDir(limbs[l], ang));
  const arc = (l: LimbName, t: number, a0: number, a1: number, n = 5): Station => ({ pts: Array.from({ length: n }, (_, i) => Lp(l, t, a0 + ((a1 - a0) * i) / (n - 1))) });
  const S = (...pts: V3[]): Station => ({ pts });
  const C = (c: V3, w: number): Station => ({ c, w });
  const off = (q: V3, x: number, y: number, z: number): V3 => add(q, [x * H, y * H, z * H]);
  const hs = (k: number, ...v: number[]) => v.map((x) => x * k);

  const out: MuscleDef[] = [];

  // ---------------------------------------------------------------- Pecho
  const xiY = p.xiphoid![1];
  out.push({
    name: 'Pectoral mayor (porción esternocostal)',
    group: 'pectoral_esternal',
    layer: 2,
    N: 10,
    M: 18,
    stations: [
      S(T(xiY - 0.014 * H, 30), F_(xiY, 0.008 * H), F_(p.sternumMid![1], 0.008 * H), F_(p.jugular![1] - 0.024 * H, 0.008 * H)),
      S(T(c7y - 0.172 * H, 36), T(c7y - 0.13 * H, 29), T(c7y - 0.09 * H, 27), T(c7y - 0.064 * H, 28)),
      S(T(c7y - 0.14 * H, 58), T(c7y - 0.115 * H, 56), T(c7y - 0.09 * H, 55), T(c7y - 0.072 * H, 56)),
      S(lerp3(T(c7y - 0.1 * H, 60), Lp('humerus', 0.16, 20), 0.6), lerp3(T(c7y - 0.075 * H, 58), Lp('humerus', 0.1, 25), 0.6)),
      S(Lp('humerus', 0.17, 20), Lp('humerus', 0.1, 25)),
    ],
    h: hs(kU, 0.004, 0.011, 0.012, 0.009, 0.003),
    wrap: [1, 1, 0.85, 0.15, 0.9],
    tendon: [0, 0.88],
  });
  out.push({
    name: 'Pectoral mayor (porción clavicular)',
    group: 'pectoral_clavicular',
    layer: 3,
    N: 8,
    M: 14,
    stations: [
      S(on(off(L.sc!, 0.006, -0.008, 0.008)), on(off(lerp3(L.sc!, p.acromion!, 0.5), 0, -0.01, 0.008))),
      S(T(c7y - 0.064 * H, 18), T(c7y - 0.052 * H, 38)),
      S(lerp3(T(c7y - 0.065 * H, 45), Lp('humerus', 0.2, 28), 0.55), lerp3(T(c7y - 0.05 * H, 50), Lp('humerus', 0.14, 34), 0.55)),
      S(Lp('humerus', 0.2, 28), Lp('humerus', 0.14, 34)),
    ],
    h: hs(kU, 0.003, 0.008, 0.008, 0.003),
    wrap: [1, 1, 0.4, 0.9],
    tendon: [0, 0.86],
  });
  // Serrato anterior: digitaciones en las costillas laterales hasta el borde medial de la escápula.
  const teeth: V3[] = [];
  for (let k = 0; k < 8; k++) teeth.push(T(c7y - 0.085 * H - k * 0.017 * H, 52 + k * 3.5 + (k % 2 ? 7 : 0)));
  out.push({
    name: 'Serrato anterior',
    group: 'serrato',
    layer: 1,
    N: 15,
    M: 10,
    stations: [{ pts: teeth }, S(T(c7y - 0.08 * H, 98), T(c7y - 0.14 * H, 100), T(c7y - 0.2 * H, 104)), S(T(c7y - 0.07 * H, 128), T(c7y - 0.12 * H, 134), T(c7y - 0.15 * H, 140))],
    h: hs(kU, 0.002, 0.006, 0.004),
    pow: 0.3,
  });

  // ---------------------------------------------------------------- Hombro
  const tub = (a: number) => Lp('humerus', 0.44, a);
  out.push({
    name: 'Deltoides (porción clavicular)',
    group: 'deltoides_anterior',
    layer: 4,
    N: 8,
    M: 14,
    stations: [
      S(on(off(lerp3(L.sc!, p.acromion!, 0.6), 0, 0.002, 0.004)), on(off(p.acromion!, -0.006, 0, 0.012))),
      arc('humerus', -0.02, 8, 60, 4),
      arc('humerus', 0.2, 25, 72, 4),
      arc('humerus', 0.36, 58, 84, 3),
      S(tub(80), tub(88)),
    ],
    h: hs(kU, 0.004, 0.013, 0.014, 0.008, 0.003),
    tendon: [0, 0.88],
  });
  out.push({
    name: 'Deltoides (porción acromial)',
    group: 'deltoides_lateral',
    layer: 4,
    N: 8,
    M: 14,
    stations: [
      S(on(off(p.acromion!, 0.002, 0.004, 0.012)), on(off(p.acromion!, 0.004, 0.004, -0.01))),
      arc('humerus', -0.03, 58, 128, 4),
      arc('humerus', 0.2, 66, 122, 4),
      arc('humerus', 0.36, 80, 102, 3),
      S(tub(85), tub(95)),
    ],
    h: hs(kU, 0.004, 0.015, 0.016, 0.009, 0.003),
    tendon: [0, 0.88],
  });
  out.push({
    name: 'Deltoides (porción espinal)',
    group: 'deltoides_posterior',
    layer: 4,
    N: 8,
    M: 14,
    stations: [
      S(on(off(p.acromion!, -0.002, 0.002, -0.014)), on(off(lerp3(p.acromion!, p.scapSpineRoot!, 0.55), 0, 0.004, 0))),
      arc('humerus', -0.02, 125, 190, 4),
      arc('humerus', 0.2, 118, 165, 4),
      arc('humerus', 0.36, 100, 122, 3),
      S(tub(92), tub(100)),
    ],
    h: hs(kU, 0.003, 0.011, 0.012, 0.007, 0.003),
    tendon: [0, 0.88],
  });
  out.push({
    name: 'Infraespinoso y redondo menor',
    group: 'otros',
    layer: 1,
    N: 9,
    M: 10,
    stations: [
      S(on(off(p.scapSpineRoot!, 0.003, -0.01, 0)), on(off(p.scapInfAngle!, 0.004, 0.014, 0))),
      S(on(off(lerp3(p.scapSpineRoot!, p.acromion!, 0.35), 0, -0.016, 0)), on(lerp3(p.scapInfAngle!, p.scapLatBorder!, 0.7))),
      S(Lp('humerus', -0.03, 140), Lp('humerus', 0.06, 152)),
    ],
    h: hs(kU, 0.004, 0.009, 0.004),
  });

  // ---------------------------------------------------------------- Espalda
  const yT7 = c7y - 0.1 * H;
  out.push({
    name: 'Dorsal ancho',
    group: 'dorsal_ancho',
    layer: 2,
    N: 14,
    M: 22,
    stations: [
      S(T(yT7, 177), T(l1y + 0.03 * H, 177), T(s1y + 0.01 * H, 177), on(off(p.psis!, 0.01, 0.012, 0)), on(off(p.iliacTop!, -0.014, 0.004, -0.03))),
      S(B(c7y - 0.105 * H, 0.03 * H), B(c7y - 0.15 * H, 0.045 * H), B(l1y, 0.055 * H), B(s1y + 0.025 * H, 0.065 * H)),
      S(T(c7y - 0.1 * H, 132), T(c7y - 0.13 * H, 124), T(c7y - 0.165 * H, 116), T(l1y + 0.005 * H, 110)),
      S(T(c7y - 0.093 * H, 116), T(c7y - 0.112 * H, 108), T(c7y - 0.135 * H, 102)),
      S(Lp('humerus', 0.17, 300), Lp('humerus', 0.11, 306)),
    ],
    h: hs(kU, 0.002, 0.006, 0.008, 0.01, 0.003),
    wrap: [1, 1, 1, 0.9, 0.3],
    tendon: [0.14, 0.9],
    pow: 0.35,
  });
  out.push({
    name: 'Redondo mayor',
    group: 'redondo_mayor',
    // Por encima del borde superior del dorsal ancho (es lo que asoma de él en la espalda).
    layer: 3,
    N: 7,
    M: 10,
    stations: [S(on(off(p.scapInfAngle!, 0.003, 0.002, 0)), on(lerp3(p.scapInfAngle!, p.scapLatBorder!, 0.5))), C(lerp3(p.scapLatBorder!, Lp('humerus', 0.13, 295), 0.5), 0.03 * kU), S(Lp('humerus', 0.15, 292), Lp('humerus', 0.1, 297))],
    h: hs(kU, 0.005, 0.013, 0.004),
    wrap: [1, 0.4, 0.9],
  });
  const zBack = L.c7![2];
  out.push({
    name: 'Trapecio (porción descendente)',
    group: 'trapecio_superior',
    layer: 3,
    N: 9,
    M: 14,
    stations: [
      S(N_(headC[1] - 0.042 * H, 170), N_(headC[1] - 0.056 * H, 176), N_(c7y + 0.03 * H, 179), T(c7y + 0.006 * H, 179)),
      S(N_(headC[1] - 0.055 * H, 140), N_(c7y + 0.035 * H, 128), N_(c7y + 0.014 * H, 132), T(c7y - 0.006 * H, 158)),
      S(on([0.044 * H, c7y + 0.004 * H, zBack + 0.042 * H]), on([0.054 * H, c7y - 0.004 * H, zBack + 0.03 * H]), on([0.058 * H, c7y - 0.012 * H, zBack + 0.016 * H]), on([0.056 * H, c7y - 0.02 * H, zBack + 0.004 * H])),
      S(on(off(lerp3(L.sc!, p.acromion!, 0.62), 0, 0.007, 0)), on(off(p.acromion!, -0.004, 0.007, -0.004)), on(off(p.acromion!, -0.012, 0.005, -0.014))),
    ],
    h: hs(kU, 0.003, 0.009, 0.012, 0.003),
    pow: 0.4,
  });
  out.push({
    name: 'Trapecio (porción transversa)',
    group: 'trapecio_medio',
    layer: 3,
    N: 8,
    M: 12,
    stations: [
      S(T(c7y + 0.006 * H, 179), T(c7y - 0.03 * H, 179), T(c7y - 0.066 * H, 179)),
      S(B(c7y - 0.002 * H, 0.026 * H), B(c7y - 0.03 * H, 0.026 * H), B(c7y - 0.058 * H, 0.024 * H)),
      S(on(off(p.acromion!, -0.008, 0.003, -0.014)), on(off(lerp3(p.acromion!, p.scapSpineRoot!, 0.5), 0, 0.005, 0)), on(off(p.scapSpineRoot!, 0, 0.004, 0))),
    ],
    h: hs(kU, 0.002, 0.006, 0.004),
    tendon: [0.12, 1],
    pow: 0.35,
  });
  out.push({
    name: 'Trapecio (porción ascendente)',
    group: 'trapecio_inferior',
    layer: 3,
    N: 8,
    M: 12,
    stations: [
      S(T(c7y - 0.068 * H, 179), T(c7y - 0.11 * H, 179), T(l1y + 0.025 * H, 179)),
      S(B(c7y - 0.06 * H, 0.024 * H), B(c7y - 0.088 * H, 0.02 * H), B(c7y - 0.118 * H, 0.014 * H)),
      S(on(off(p.scapSpineRoot!, 0, -0.004, 0)), on(off(p.scapSpineRoot!, 0.006, 0.004, 0))),
    ],
    h: hs(kU, 0.002, 0.005, 0.003),
    tendon: [0.1, 1],
    pow: 0.35,
  });
  out.push({
    name: 'Erector de la columna',
    group: 'erectores',
    layer: 1,
    N: 8,
    M: 18,
    stations: [
      S(on(off(p.sacrum!, 0.008, 0.012, 0)), on(off(p.psis!, 0.002, 0.004, 0))),
      S(B(s1y + 0.04 * H, 0.006 * H), B(s1y + 0.04 * H, 0.04 * H)),
      S(B(l1y, 0.006 * H), B(l1y, 0.04 * H)),
      S(B(c7y - 0.1 * H, 0.006 * H), B(c7y - 0.1 * H, 0.026 * H)),
      S(B(c7y - 0.02 * H, 0.006 * H), B(c7y - 0.02 * H, 0.016 * H)),
    ],
    h: hs(kT, 0.005, 0.015, 0.013, 0.006, 0.002),
    tendon: [0.08, 1],
  });

  // ---------------------------------------------------------------- Abdomen
  const navY = p.navel![1];
  const pubY = p.pubis![1];
  out.push({
    name: 'Recto abdominal',
    group: 'abdominales',
    layer: 1,
    N: 7,
    M: 28,
    stations: [
      S(F_(pubY + 0.006 * H, 0.004 * H), F_(pubY + 0.006 * H, 0.02 * H)),
      S(F_(yHip + 0.04 * H, 0.006 * H), F_(yHip + 0.04 * H, 0.04 * H)),
      S(F_(navY, 0.006 * H), F_(navY, 0.044 * H)),
      S(F_(navY + 0.06 * H, 0.006 * H), F_(navY + 0.06 * H, 0.049 * H)),
      S(F_(xiY, 0.006 * H), F_(xiY - 0.006 * H, 0.06 * H)),
    ],
    h: [
      [0, 0.003 * kT],
      [0.14, 0.008 * kT],
      [0.36, 0.01 * kT],
      [0.45, 0.005 * kT],
      [0.52, 0.01 * kT],
      [0.66, 0.01 * kT],
      [0.72, 0.005 * kT],
      [0.79, 0.01 * kT],
      [0.88, 0.008 * kT],
      [0.93, 0.004 * kT],
      [1, 0.004 * kT],
    ],
    pow: 0.35,
  });
  out.push({
    name: 'Oblicuo externo',
    group: 'abdominales',
    layer: 1,
    N: 10,
    M: 12,
    stations: [
      S(T(c7y - 0.135 * H, 52), T(c7y - 0.16 * H, 66), T(c7y - 0.185 * H, 80), T(l1y, 100), T(l1y - 0.02 * H, 112)),
      S(T(c7y - 0.172 * H, 46), T(navY + 0.025 * H, 62), T(navY - 0.008 * H, 78), T(yHip + 0.085 * H, 92), T(p.iliacTop![1] + 0.004 * H, 102)),
      S(F_(navY + 0.045 * H, 0.062 * H), F_(navY - 0.01 * H, 0.06 * H), F_(yHip + 0.05 * H, 0.056 * H), on(off(p.asis!, 0, 0.01, 0)), on(off(p.iliacTop!, 0, 0.008, 0.012))),
    ],
    h: hs(kT, 0.004, 0.007, 0.003),
    tendon: [0, 0.86],
    pow: 0.35,
  });

  // ---------------------------------------------------------------- Brazo
  out.push({
    name: 'Braquial',
    group: 'braquial',
    layer: 1,
    stations: [C(Lp('humerus', 0.42, 40), 0.03 * kU), C(Lp('humerus', 0.65, 15), 0.05 * kU), C(Lp('humerus', 0.9, 5), 0.045 * kU), C(Lp('forearm', 0.08, 340), 0.015 * kU)],
    h: hs(kU, 0.004, 0.009, 0.009, 0.003),
  });
  out.push({
    name: 'Bíceps braquial',
    group: 'biceps',
    layer: 2,
    M: 18,
    stations: [
      S(on(p.coracoid!), Lp('humerus', -0.03, 30)),
      C(Lp('humerus', 0.22, 10), 0.026 * kU),
      C(Lp('humerus', 0.5, 5), 0.042 * kU),
      C(Lp('humerus', 0.78, 0), 0.036 * kU),
      C(Lp('forearm', 0.06, 25), 0.012 * kU),
      C(Lp('forearm', 0.12, 40), 0.008 * kU),
    ],
    h: hs(kU, 0.003, 0.009, 0.016, 0.012, 0.004, 0.003),
    wrap: [0.6, 1, 1, 1, 0.7, 0.9],
    tendon: [0.12, 0.8],
  });
  out.push({
    name: 'Tríceps braquial',
    group: 'triceps',
    layer: 2,
    N: 12,
    M: 16,
    stations: [
      S(on(off(gh, -0.008, -0.02, -0.012)), Lp('humerus', 0.12, 125)),
      arc('humerus', 0.3, 240, 130),
      arc('humerus', 0.55, 245, 125),
      arc('humerus', 0.78, 225, 145),
      arc('humerus', 0.98, 200, 165, 3),
    ],
    h: hs(kU, 0.004, 0.012, 0.016, 0.009, 0.003),
    tendon: [0, 0.72],
  });
  out.push({
    name: 'Braquiorradial',
    group: 'braquial',
    layer: 2,
    stations: [
      C(Lp('humerus', 0.66, 100), 0.012 * kU),
      C(Lp('humerus', 0.88, 85), 0.028 * kU),
      C(Lp('forearm', 0.18, 65), 0.034 * kU),
      C(Lp('forearm', 0.45, 75), 0.024 * kU),
      C(Lp('forearm', 0.7, 80), 0.012 * kU),
      C(Lp('forearm', 0.97, 85), 0.008 * kU),
    ],
    h: hs(kU, 0.003, 0.009, 0.012, 0.009, 0.004, 0.002),
    tendon: [0, 0.62],
  });
  out.push({
    name: 'Flexores del antebrazo',
    group: 'antebrazo',
    layer: 1,
    N: 12,
    M: 16,
    stations: [C(Lp('humerus', 0.95, 280), 0.02 * kU), arc('forearm', 0.2, 290, 380), arc('forearm', 0.45, 275, 395), arc('forearm', 0.72, 285, 385), arc('forearm', 0.96, 300, 370, 4)],
    h: hs(kU, 0.004, 0.012, 0.011, 0.006, 0.003),
    tendon: [0, 0.68],
  });
  out.push({
    name: 'Pronador redondo',
    group: 'antebrazo',
    layer: 2,
    N: 7,
    M: 10,
    stations: [C(Lp('humerus', 0.93, 300), 0.012 * kU), C(Lp('forearm', 0.15, 10), 0.025 * kU), C(Lp('forearm', 0.4, 70), 0.015 * kU)],
    h: hs(kU, 0.003, 0.008, 0.003),
  });
  out.push({
    name: 'Extensores del antebrazo',
    group: 'otros',
    layer: 1,
    N: 11,
    M: 16,
    stations: [C(Lp('humerus', 0.97, 100), 0.016 * kU), arc('forearm', 0.18, 115, 205), arc('forearm', 0.45, 110, 215), arc('forearm', 0.75, 125, 205), arc('forearm', 0.97, 140, 200, 4)],
    h: hs(kU, 0.004, 0.011, 0.01, 0.005, 0.002),
    tendon: [0, 0.66],
  });

  // ---------------------------------------------------------------- Cadera y muslo
  out.push({
    name: 'Glúteo mayor',
    group: 'gluteo_mayor',
    layer: 2,
    N: 12,
    M: 16,
    stations: [
      S(on(off(p.psis!, 0.006, 0.014, 0)), on(p.psis!), on(off(p.sacrum!, 0.012, -0.012, 0)), on(off(p.coccyx!, 0.008, 0, 0))),
      S(B(yHip + 0.05 * H, 0.05 * H), B(yHip + 0.02 * H, 0.045 * H), B(yHip - 0.02 * H, 0.04 * H), B(yHip - 0.05 * H, 0.032 * H)),
      S(on([0.078 * H, yHip + 0.035 * H, -0.04 * H]), on([0.082 * H, yHip, -0.05 * H]), on([0.076 * H, yHip - 0.04 * H, -0.05 * H]), on([0.064 * H, yHip - 0.07 * H, -0.04 * H])),
      S(Lp('thigh', 0.0, 115), Lp('thigh', 0.1, 125), Lp('thigh', 0.2, 145), Lp('thigh', 0.27, 165)),
    ],
    h: hs(kL, 0.005, 0.021, 0.019, 0.006),
    tendon: [0, 0.86],
    pow: 0.4,
  });
  const pw = F ? 1.1 : 1;
  out.push({
    name: 'Glúteo medio',
    group: 'gluteo_medio',
    layer: 1,
    N: 9,
    M: 10,
    stations: [
      S(on(off(p.asis!, -0.004, 0.008, -0.01)), on(off(p.iliacTop!, 0, 0.004, 0)), on([0.06 * H, p.iliacTop![1] - 0.004 * H, -0.045 * H])),
      S(on([0.085 * H * pw, yHip + 0.04 * H, 0.015 * H]), on([0.09 * H * pw, yHip + 0.04 * H, -0.02 * H]), on([0.08 * H, yHip + 0.035 * H, -0.045 * H])),
      S(on(off(p.trochanter!, 0, 0.012, 0.01)), on(off(p.trochanter!, 0, 0.014, -0.012))),
    ],
    h: hs(kL, 0.004, 0.013, 0.004),
  });
  out.push({
    name: 'Tensor de la fascia lata',
    group: 'otros',
    layer: 2,
    N: 7,
    M: 10,
    stations: [C(on(off(p.asis!, 0.006, -0.004, -0.012)), 0.018 * kL), C(Lp('thigh', 0.12, 75), 0.03 * kL), C(Lp('thigh', 0.22, 85), 0.024 * kL)],
    h: hs(kL, 0.003, 0.009, 0.003),
  });
  out.push({
    name: 'Recto femoral',
    group: 'cuadriceps',
    layer: 2,
    M: 18,
    stations: [C(on(off(p.asis!, -0.006, -0.022, 0)), 0.012 * kL), C(Lp('thigh', 0.12, 5), 0.03 * kL), C(Lp('thigh', 0.42, 0), 0.052 * kL), C(Lp('thigh', 0.75, 0), 0.04 * kL), C(Lp('thigh', 0.93, 0), 0.022 * kL)],
    h: hs(kL, 0.003, 0.012, 0.02, 0.014, 0.003),
    tendon: [0.1, 0.84],
  });
  out.push({
    name: 'Vasto lateral',
    group: 'cuadriceps',
    layer: 1,
    N: 11,
    M: 16,
    stations: [arc('thigh', 0.07, 80, 130), arc('thigh', 0.3, 45, 150), arc('thigh', 0.6, 40, 140), arc('thigh', 0.84, 35, 110), arc('thigh', 0.96, 25, 55, 3)],
    h: hs(kL, 0.006, 0.02, 0.022, 0.012, 0.003),
    tendon: [0, 0.88],
  });
  out.push({
    name: 'Vasto medial',
    group: 'cuadriceps',
    layer: 1,
    N: 9,
    M: 14,
    stations: [arc('thigh', 0.35, 300, 330, 3), arc('thigh', 0.58, 285, 345), arc('thigh', 0.82, 285, 355), arc('thigh', 0.95, 320, 350, 3)],
    h: hs(kL, 0.004, 0.012, 0.022, 0.006),
    tendon: [0, 0.9],
  });
  out.push({
    name: 'Ligamento rotuliano',
    group: 'tendon',
    layer: 1,
    N: 6,
    M: 6,
    stations: [C(on(off(p.patella!, 0, -0.014, 0)), 0.03 * kL), C(on(p.tibTub!), 0.026 * kL)],
    h: hs(kL, 0.004, 0.003),
  });
  out.push({
    name: 'Bíceps femoral',
    group: 'isquiotibiales',
    layer: 2,
    M: 18,
    stations: [C(on(p.ischium!), 0.015 * kL), C(Lp('thigh', 0.25, 175), 0.035 * kL), C(Lp('thigh', 0.55, 155), 0.042 * kL), C(Lp('thigh', 0.82, 130), 0.03 * kL), C(Lp('shank', 0.05, 115), 0.012 * kL)],
    h: hs(kL, 0.004, 0.016, 0.017, 0.01, 0.003),
    tendon: [0.06, 0.85],
  });
  out.push({
    name: 'Semitendinoso y semimembranoso',
    group: 'isquiotibiales',
    layer: 2,
    M: 18,
    stations: [C(on(off(p.ischium!, -0.004, 0, 0)), 0.018 * kL), C(Lp('thigh', 0.25, 195), 0.04 * kL), C(Lp('thigh', 0.55, 210), 0.045 * kL), C(Lp('thigh', 0.85, 228), 0.032 * kL), C(Lp('shank', 0.08, 245), 0.015 * kL)],
    h: hs(kL, 0.004, 0.016, 0.018, 0.012, 0.003),
    tendon: [0.06, 0.86],
  });
  out.push({
    name: 'Aductor mayor',
    group: 'aductores',
    layer: 1,
    N: 10,
    M: 14,
    stations: [S(on(off(p.pubis!, 0.014, -0.016, -0.01)), on(off(p.ischium!, -0.004, -0.004, 0.004))), arc('thigh', 0.25, 230, 275), arc('thigh', 0.55, 225, 265), arc('thigh', 0.85, 245, 265, 3)],
    h: hs(kL, 0.004, 0.016, 0.014, 0.005),
  });
  out.push({
    name: 'Aductor largo',
    group: 'aductores',
    layer: 2,
    N: 8,
    M: 12,
    stations: [C(on(off(p.pubis!, 0.016, -0.004, 0)), 0.012 * kL), arc('thigh', 0.15, 275, 305, 4), arc('thigh', 0.35, 260, 290, 4), C(Lp('thigh', 0.55, 245), 0.012 * kL)],
    h: hs(kL, 0.003, 0.012, 0.012, 0.003),
  });
  out.push({
    name: 'Grácil',
    group: 'aductores',
    layer: 2,
    N: 7,
    M: 16,
    stations: [C(on(off(p.pubis!, 0.008, -0.022, -0.004)), 0.02 * kL), C(Lp('thigh', 0.3, 255), 0.03 * kL), C(Lp('thigh', 0.7, 250), 0.02 * kL), C(Lp('thigh', 0.97, 240), 0.012 * kL), C(Lp('shank', 0.08, 255), 0.01 * kL)],
    h: hs(kL, 0.003, 0.007, 0.006, 0.003, 0.002),
    tendon: [0, 0.75],
  });
  out.push({
    name: 'Sartorio',
    group: 'otros',
    layer: 3,
    N: 7,
    M: 22,
    stations: [C(on(p.asis!), 0.014 * kL), C(Lp('thigh', 0.15, 25), 0.028 * kL), C(Lp('thigh', 0.42, 320), 0.03 * kL), C(Lp('thigh', 0.75, 268), 0.026 * kL), C(Lp('thigh', 1.0, 245), 0.018 * kL), C(Lp('shank', 0.08, 265), 0.012 * kL)],
    h: hs(kL, 0.002, 0.005, 0.006, 0.005, 0.003, 0.002),
    tendon: [0.05, 0.92],
  });
  out.push({
    name: 'Tracto iliotibial',
    group: 'tendon',
    layer: 3,
    N: 6,
    M: 14,
    stations: [C(Lp('thigh', 0.18, 95), 0.035 * kL), C(Lp('thigh', 0.5, 98), 0.035 * kL), C(Lp('thigh', 0.85, 95), 0.03 * kL), C(Lp('shank', 0.02, 70), 0.02 * kL)],
    h: hs(kL, 0.0016, 0.0016, 0.0016, 0.0014),
    pow: 0.25,
  });

  // ---------------------------------------------------------------- Pierna
  out.push({
    name: 'Gastrocnemio (cabeza medial)',
    group: 'gastrocnemio',
    layer: 2,
    M: 16,
    stations: [C(Lp('thigh', 0.94, 210), 0.02 * kL), C(Lp('shank', 0.12, 208), 0.04 * kL), C(Lp('shank', 0.35, 203), 0.042 * kL), C(Lp('shank', 0.52, 192), 0.028 * kL), C(Lp('shank', 0.6, 185), 0.016 * kL)],
    h: hs(kL, 0.004, 0.015, 0.017, 0.008, 0.002),
    tendon: [0.06, 0.82],
  });
  out.push({
    name: 'Gastrocnemio (cabeza lateral)',
    group: 'gastrocnemio',
    layer: 2,
    M: 16,
    stations: [C(Lp('thigh', 0.94, 150), 0.018 * kL), C(Lp('shank', 0.12, 150), 0.036 * kL), C(Lp('shank', 0.3, 155), 0.038 * kL), C(Lp('shank', 0.45, 168), 0.024 * kL), C(Lp('shank', 0.55, 178), 0.014 * kL)],
    h: hs(kL, 0.004, 0.013, 0.015, 0.007, 0.002),
    tendon: [0.06, 0.82],
  });
  out.push({
    name: 'Tendón calcáneo',
    group: 'tendon',
    layer: 2,
    N: 6,
    M: 12,
    stations: [C(Lp('shank', 0.55, 182), 0.032 * kL), C(Lp('shank', 0.78, 180), 0.02 * kL), C(Lp('shank', 0.95, 180), 0.015 * kL), C(on(off(p.calcaneus!, 0, 0, -0.012)), 0.02 * kL)],
    h: hs(kL, 0.003, 0.004, 0.004, 0.003),
  });
  out.push({
    name: 'Sóleo',
    group: 'soleo',
    layer: 1,
    N: 11,
    M: 14,
    stations: [arc('shank', 0.15, 140, 235), arc('shank', 0.4, 115, 255), arc('shank', 0.62, 130, 240), arc('shank', 0.8, 160, 205, 3)],
    h: hs(kL, 0.004, 0.013, 0.011, 0.004),
    tendon: [0, 0.85],
  });
  out.push({
    name: 'Tibial anterior',
    group: 'otros',
    layer: 1,
    N: 7,
    M: 16,
    stations: [arc('shank', 0.08, 40, 80, 3), arc('shank', 0.35, 35, 85, 3), arc('shank', 0.65, 25, 60, 3), C(Lp('shank', 0.95, 350), 0.012 * kL)],
    h: hs(kL, 0.004, 0.012, 0.007, 0.002),
    tendon: [0, 0.7],
  });
  out.push({
    name: 'Peroneo largo',
    group: 'otros',
    layer: 1,
    N: 7,
    M: 14,
    stations: [arc('shank', 0.07, 100, 128, 3), arc('shank', 0.4, 98, 132, 3), arc('shank', 0.7, 110, 135, 3), C(Lp('shank', 0.98, 150), 0.01 * kL)],
    h: hs(kL, 0.003, 0.009, 0.006, 0.002),
    tendon: [0, 0.7],
  });
  out.push({
    name: 'Extensor largo de los dedos',
    group: 'otros',
    layer: 1,
    N: 6,
    M: 12,
    stations: [arc('shank', 0.1, 82, 98, 3), arc('shank', 0.5, 85, 100, 3), C(Lp('shank', 0.95, 40), 0.015 * kL)],
    h: hs(kL, 0.003, 0.007, 0.002),
    tendon: [0, 0.75],
  });

  // ---------------------------------------------------------------- Cuello
  out.push({
    name: 'Esternocleidomastoideo',
    group: 'otros',
    layer: 2,
    N: 7,
    M: 14,
    stations: [C(on(p.mastoid!), 0.016 * kU), C(N_(c7y + 0.06 * H, 62), 0.026 * kU), C(N_(c7y + 0.03 * H, 32), 0.024 * kU), S(on(off(p.jugular!, 0.006, 0.004, 0)), on(off(L.sc!, 0.006, 0.004, 0.004)))],
    h: hs(kU, 0.003, 0.008, 0.008, 0.003),
    tendon: [0.05, 0.85],
  });

  return out;
}
