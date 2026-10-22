import type { Skeleton } from './skeleton';
import { add, capsule, ellipsoid, mirrorX, norm, roundBox, roundCone, scale, smin, sphere, sub, tube, Union, cross, type Field, type Shape, type V3 } from './sdf';

/**
 * Volúmenes del cuerpo que no son músculos superficiales:
 *  - núcleo: hueso + musculatura profunda (sobre él se apoyan los músculos y es lo que se ve entre ellos);
 *  - formas solo de piel: cabeza y cara, mamas, grasa por regiones;
 *  - guantes, calzado, pelo y ojos (piezas opacas de acabado).
 * Todo en metros, a partir del esqueleto en reposo (solo hace falta el lado izquierdo: se refleja).
 */

/** Ambos lados de una forma descrita para el lado izquierdo. */
function both(make: (m: (v: V3) => V3) => Shape | Shape[]): Shape[] {
  const id = (v: V3) => v;
  return [make(id), make(mirrorX)].flat();
}

/** Une formas con su propio acuerdo y las expone como una sola. */
export function group(shapes: readonly Shape[], k: number): Shape {
  const u = new Union(shapes, k);
  return { f: u.f, ...u.bounds };
}

export interface CoreParts {
  /** Núcleo profundo completo (ambos lados). */
  core: Shape[];
  /** Formas que solo cuentan para la piel (cara, orejas, mamas...). */
  skinExtras: Shape[];
  /** Huecos de la piel (cuencas de los ojos). */
  skinCuts: Shape[];
  fat: Field;
}

export function coreParts(sk: Skeleton): CoreParts {
  const { H, L, p } = sk;
  const F = sk.sex === 'F';
  const c7y = L.c7![1];
  const yHip = L.hjc![1];
  const w = F ? 0.88 : 1; // anchura del tórax
  const pw = F ? 1.14 : 1; // anchura de la pelvis

  // --- Tronco: tórax superior, caja costal, abdomen y pelvis con un acuerdo amplio.
  const trunk = group(
    [
      ellipsoid([0, c7y - 0.06 * H, 0.009 * H], [0.062 * H * w, 0.055 * H, 0.05 * H]),
      ellipsoid([0, c7y - 0.13 * H, 0.011 * H], [0.074 * H * w, 0.08 * H, 0.053 * H * (F ? 0.95 : 1)]),
      ellipsoid([0, yHip + 0.105 * H, 0.004 * H], [0.064 * H * (F ? 0.84 : 1), 0.07 * H, 0.044 * H * (F ? 0.94 : 1)]),
      ellipsoid([0, yHip + 0.025 * H, -0.006 * H], [0.073 * H * pw, 0.06 * H, 0.055 * H]),
    ],
    0.05 * H,
  );
  // Arcos posteriores de las costillas a ambos lados de la columna (la espalda alta es más profunda
  // junto a la columna que en el centro de la caja: sección «arriñonada») y la columna en el surco
  // entre los erectores. Acuerdo corto: no deben hinchar la línea media.
  const back = group(
    [
      trunk,
      ...both((m) => ellipsoid(m([0.045 * H * w, c7y - 0.11 * H, -0.025 * H]), [0.035 * H * w, 0.085 * H, 0.024 * H])),
      roundCone([0, yHip + 0.02 * H, -0.047 * H], [0, c7y - 0.01 * H, -0.043 * H], 0.009 * H, 0.006 * H),
    ],
    0.012 * H,
  );

  const parts: Shape[] = [back];
  // Cuello y cabeza (el cráneo, la cara y la mandíbula se afinan en la piel).
  const headC = p.headC!;
  parts.push(
    roundCone([0, c7y - 0.012 * H, L.c7![2] + 0.03 * H], [0, headC[1] - 0.045 * H, headC[2] - 0.004 * H], 0.025 * H * (F ? 0.9 : 1), 0.023 * H * (F ? 0.9 : 1)),
    ellipsoid(add(headC, [0, 0.01 * H, -0.004 * H]), [0.041 * H, 0.052 * H, 0.052 * H]),
    ellipsoid(add(headC, [0, -0.036 * H, 0.02 * H]), [0.031 * H, 0.03 * H, 0.036 * H]),
  );

  const limbs = sk.limbs;
  parts.push(
    ...both((m) => {
      const out: Shape[] = [];
      // Hombro: cabeza humeral y manguito; escápula sobre la parrilla costal; clavícula.
      out.push(sphere(m(L.gh!), 0.019 * H));
      const n = norm(m([0.42, 0.05, -0.9]));
      const up: V3 = [0, 1, 0];
      const ax = norm(cross(up, n));
      // Placa algo más gruesa que una celda de mallado, hundida lo que crece hacia dentro.
      const sc = add(add(scale(add(p.scapSpineRoot!, p.scapInfAngle!), 0.5), [0.012 * H, 0.004 * H, 0]), scale(n, -0.003 * H));
      out.push(ellipsoid(m(sc), [0.034 * H, 0.055 * H, 0.007 * H], [ax, up, n]));
      out.push(capsule(m(L.sc!), m(p.acromion!), 0.006 * H));
      // Brazo, codo, antebrazo y muñeca.
      out.push(roundCone(m(L.gh!), m(L.elbow!), 0.011 * H * (F ? 0.88 : 1), 0.0105 * H * (F ? 0.88 : 1)));
      out.push(ellipsoid(m(L.elbow!), [0.018 * H, 0.012 * H, 0.012 * H], [m(limbs.humerus.lat), m(limbs.humerus.axis), m(limbs.humerus.ant)]));
      out.push(roundCone(m(L.elbow!), m(L.wrist!), 0.0105 * H * (F ? 0.86 : 1), 0.0072 * H * (F ? 0.9 : 1)));
      out.push(ellipsoid(m(L.wrist!), [0.014 * H, 0.008 * H, 0.008 * H], [m(sk.hand.radial), m(sk.hand.axis), m(sk.hand.palm)]));
      // Cadera, muslo, rodilla, pierna y tobillo.
      out.push(sphere(m(p.trochanter!), 0.016 * H));
      out.push(roundCone(m(L.hjc!), m(L.knee!), 0.031 * H * (F ? 1.04 : 1), 0.02 * H));
      out.push(ellipsoid(m(L.knee!), [0.028 * H, 0.024 * H, 0.025 * H]));
      out.push(roundCone(m(L.knee!), m(L.ankle!), 0.02 * H, 0.0115 * H));
      out.push(ellipsoid(m(add(L.ankle!, [0, 0.004 * H, 0.002 * H])), [0.018 * H, 0.015 * H, 0.018 * H]));
      return out;
    }),
  );

  // --- Solo piel: cara, orejas, cejas, nariz, mamas.
  const skinExtras: Shape[] = [];
  skinExtras.push(
    // Cabeza de maniquí: bóveda, máscara facial, mandíbula y mentón, nariz y orejas (sin rasgos finos).
    ellipsoid(add(headC, [0, 0.014 * H, -0.006 * H]), [0.042 * H, 0.05 * H, 0.054 * H]),
    ellipsoid(add(headC, [0, -0.016 * H, 0.018 * H]), [0.036 * H, 0.046 * H, 0.038 * H]),
    ellipsoid(add(headC, [0, -0.045 * H, 0.022 * H]), [0.031 * H * (F ? 0.9 : 1), 0.022 * H, 0.032 * H]),
    ellipsoid(add(headC, [0, -0.06 * H, 0.04 * H]), [0.012 * H, 0.01 * H, 0.01 * H]),
    roundCone(add(headC, [0, 0.006 * H, 0.052 * H]), add(headC, [0, -0.013 * H, 0.059 * H]), 0.0038 * H, 0.0052 * H),
    ...both((m) => ellipsoid(m(add(headC, [0.042 * H, -0.002 * H, -0.004 * H])), [0.005 * H, 0.016 * H, 0.01 * H], [[1, 0, 0], norm([0, 1, -0.25]), norm([0, 0.25, 1])])),
  );
  if (F) {
    skinExtras.push(
      ...both((m) => ellipsoid(m([0.046 * H, c7y - 0.128 * H, 0.054 * H]), [0.027 * H, 0.026 * H, 0.021 * H], [norm(m([1, 0, 0.3])), norm([0, 1, 0.12]), norm(m([-0.3, -0.1, 1]))])),
    );
  }
  const skinCuts: Shape[] = [];

  // --- Grasa subcutánea por regiones (gaussianas simétricas).
  const blobs: Array<[V3, number, number]> = F
    ? [
        [[0.09 * H, yHip - 0.02 * H, -0.03 * H], 0.07 * H, 0.02 * H], // caderas y glúteos
        [[0.07 * H, yHip - 0.08 * H, 0.0], 0.06 * H, 0.012 * H], // muslo superior
        [[0.05 * H, yHip - 0.02 * H, -0.07 * H], 0.05 * H, 0.012 * H], // glúteo
        [[0.0, yHip + 0.07 * H, 0.06 * H], 0.05 * H, 0.006 * H], // vientre bajo
        [[0.12 * H, c7y - 0.13 * H, -0.03 * H], 0.05 * H, 0.004 * H], // brazo posterior
      ]
    : [
        [[0.0, yHip + 0.09 * H, 0.06 * H], 0.06 * H, 0.008 * H], // abdomen
        [[0.08 * H, yHip + 0.08 * H, -0.02 * H], 0.04 * H, 0.006 * H], // flancos
      ];
  const base = F ? 0.0065 : 0.0042;
  const fat: Field = (x, y, z) => {
    let f = base;
    const ax = Math.abs(x);
    for (const [c, s, a] of blobs) {
      const d2 = (ax - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2;
      if (d2 < 9 * s * s) f += a * Math.exp(-d2 / (2 * s * s));
    }
    // Menos grasa en la cabeza, manos y pies, y en la cara anterior de la tibia.
    if (y > c7y + 0.04 * H) f = Math.min(f, 0.003);
    return f;
  };
  return { core: parts, skinExtras, skinCuts, fat };
}

/** Distancia del núcleo y de la piel a partir de las piezas (los músculos se añaden aparte). */
export function unionField(shapes: readonly Shape[], k: number): Field {
  return new Union(shapes, k).f;
}

/** Mano enguantada (lado izquierdo): palma, dedos, pulgar con su eminencia y puño del guante. */
export function handShapes(sk: Skeleton): Shape[] {
  const { L, H, hand } = sk;
  const F = sk.sex === 'F';
  const hs = H * (F ? 0.97 : 1);
  const out: Shape[] = [];
  const m0 = L.m0!;
  const wrist = L.wrist!;
  const center = add(scale(add(wrist, m0), 0.5), scale(hand.palm, 0.001 * hs));
  const half = 0.5 * Math.hypot(...sub(m0, wrist));
  const breadth = 0.05 * hs * (F ? 0.94 : 1);
  out.push(roundBox(center, [breadth * 0.5, half * 1.02, 0.0125 * hs * (F ? 0.94 : 1)], 0.0085 * hs, [hand.radial, hand.axis, hand.palm]));
  // Nudillos.
  for (const f of ['i', 'm', 'r', 'p'] as const) {
    const fg = sk.fingers[f];
    out.push(...tube(fg.pts, fg.r));
    // Unión dedo-palma.
    out.push(roundCone(add(fg.pts[0]!, scale(hand.axis, -0.02 * hs)), fg.pts[0]!, fg.r[0]! * 1.05, fg.r[0]! * 1.08));
  }
  const t = sk.fingers.t;
  out.push(...tube(t.pts, t.r));
  // Eminencia tenar e hipotenar.
  out.push(ellipsoid(add(add(wrist, scale(hand.axis, 0.03 * hs)), add(scale(hand.radial, 0.014 * hs), scale(hand.palm, 0.008 * hs))), [0.013 * hs, 0.022 * hs, 0.011 * hs], [hand.radial, hand.axis, hand.palm]));
  out.push(ellipsoid(add(add(wrist, scale(hand.axis, 0.03 * hs)), add(scale(hand.radial, -0.017 * hs), scale(hand.palm, 0.006 * hs))), [0.011 * hs, 0.024 * hs, 0.009 * hs], [hand.radial, hand.axis, hand.palm]));
  // Puño del guante: un poco más ancho que la muñeca, sube por el antebrazo.
  const fore = norm(sub(L.wrist!, L.elbow!));
  out.push(roundCone(sub(wrist, scale(fore, 0.03 * hs)), add(wrist, scale(hand.axis, 0.012 * hs)), 0.023 * hs * (F ? 0.92 : 1), 0.021 * hs * (F ? 0.92 : 1)));
  return out;
}

/**
 * Zapatilla (lado izquierdo): el pie (cadena de conos redondeados por su línea media, aplanada en
 * altura, más el tobillo) engrosado unos milímetros, unido a una suela plana y cortado a la altura de
 * la caña. Así la horma envuelve el pie sin huecos.
 */
export function shoeShapes(sk: Skeleton): { shapes: Shape[]; clip: Field } {
  const { L, H } = sk;
  const F = sk.sex === 'F';
  const k = (H / 1.75) * (F ? 0.95 : 1);
  const heel = L.heel!;
  const toe = L.toe!;
  const ankle = L.ankle!;
  const dir = norm(sub(toe, heel));
  const fl = Math.hypot(...sub(toe, heel));
  const at = (t: number, y: number): V3 => add(add(heel, scale(dir, t * fl)), [0, y * k, 0]);
  const sy = 1.45;
  const y0 = 0.03 * k;
  const flat = (s: Shape): Shape => ({ f: (x, y, z) => s.f(x, (y - y0) * sy + y0, z) / sy, lo: [s.lo[0], y0 + (s.lo[1] - y0) / sy, s.lo[2]], hi: [s.hi[0], y0 + (s.hi[1] - y0) / sy, s.hi[2]] });
  const foot = [
    ...tube([at(0.1, 0.034), at(0.42, 0.046), at(0.72, 0.028), at(0.93, 0.022)], [0.036 * k, 0.04 * k, 0.047 * k, 0.032 * k]).map(flat),
    roundCone(add(ankle, [0, -0.02 * k, -0.004 * k]), add(ankle, [0, 0.05 * k, -0.01 * k]), 0.032 * k, 0.03 * k),
  ];
  const side = norm(cross([0, 1, 0], dir));
  const sole = roundBox(add(at(0.5, 0), [0, 0.012 * k, 0]), [0.05 * k, 0.012 * k, fl * 0.53], 0.011 * k, [side[0] > 0 ? side : scale(side, -1), [0, 1, 0], dir]);
  const upper = group(foot, 0.03 * k);
  const shell: Shape = { f: (x, y, z) => upper.f(x, y, z) - 0.007 * k, lo: upper.lo, hi: upper.hi };
  const top = ankle[1] + 0.022 * k;
  return { shapes: [shell, sole], clip: (_x, y) => Math.max(-y - 0.0005, y - top) };
}

/** Pelo: casquete sobre el cráneo (corto en el hombre, con moño en la mujer). */
export function hairField(sk: Skeleton, headSkin: Field): Field {
  const { H, p } = sk;
  const headC = p.headC!;
  const F = sk.sex === 'F';
  const thick = F ? 0.011 : 0.0065;
  // Línea del pelo: plano inclinado (frente alta, nuca baja) y patillas por encima de las orejas.
  const n = norm([0, 1, F ? -0.55 : -0.42]);
  const o = add(headC, [0, F ? -0.004 * H : 0.006 * H, F ? 0.02 * H : 0.014 * H]);
  const bun = F ? ellipsoid(add(headC, [0, 0.03 * H, -0.062 * H]), [0.026 * H, 0.024 * H, 0.024 * H]) : null;
  return (x, y, z) => {
    const s = headSkin(x, y, z);
    let shell = Math.max(s - thick, -s - 0.001);
    const plane = -((x - o[0]) * n[0] + (y - o[1]) * n[1] + (z - o[2]) * n[2]);
    // Sin pelo delante de las orejas por debajo de la sien.
    const temple = -(y - (headC[1] + 0.012 * H)) + (z - (headC[2] + 0.01 * H)) * 0.6;
    shell = Math.max(shell, plane);
    if (Math.abs(x) > 0.03 * H) shell = Math.max(shell, Math.min(temple, 0.02));
    if (bun) shell = smin(shell, bun.f(x, y, z), 0.01);
    return shell;
  };
}

/** Ojos: esclerótica e iris (lado izquierdo). */
export function eyeShapes(sk: Skeleton): { sclera: Shape; iris: Shape } {
  const { H, p } = sk;
  const c = add(p.headC!, [0.017 * H, 0.004 * H, 0.0495 * H]);
  return { sclera: ellipsoid(c, [0.0062 * H, 0.0034 * H, 0.003 * H]), iris: sphere(add(c, [0, 0, 0.0012 * H]), 0.0026 * H) };
}

/** Huesos visibles a través de la piel: clavículas y rótulas (lado izquierdo). */
export function boneShapes(sk: Skeleton): Array<{ name: string; shape: Shape }> {
  const { L, H, p } = sk;
  const mid = add(scale(add(L.sc!, p.acromion!), 0.5), [0, 0.006 * H, 0.012 * H]);
  return [
    { name: 'Clavícula', shape: group(tube([add(L.sc!, [0, -0.006 * H, -0.002 * H]), add(mid, [0, -0.008 * H, -0.006 * H]), add(p.acromion!, [0, -0.008 * H, -0.002 * H])], [0.0038 * H, 0.0036 * H, 0.0045 * H]), 0.004) },
    { name: 'Rótula', shape: ellipsoid(add(p.patella!, [0, 0, -0.014 * H]), [0.011 * H, 0.013 * H, 0.005 * H]) },
  ];
}
