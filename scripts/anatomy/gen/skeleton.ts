import { computeSegments, DEFAULT_ANTHRO, type Segments, type Sex } from '../../../src/engine/anthropometry';
import { add, cross, lerp3, norm, scale, sub, type V3 } from './sdf';

/**
 * Esqueleto en reposo (posición anatómica: de pie, brazos algo separados, palmas al frente) con
 * las MISMAS proporciones que el motor (`computeSegments`), así el rig casi no tiene que deformar
 * el modelo. Ejes del motor: X a la izquierda del sujeto, Y arriba, Z anterior; origen en el suelo
 * bajo el punto medio de las caderas. Solo se describe el lado izquierdo (X > 0) y la línea media.
 */

export interface Limb {
  /** Origen (articulación proximal) y fin (distal) del eje. */
  a: V3;
  b: V3;
  /** Base: eje proximal → distal, anterior y lateral (perpendiculares al eje). */
  axis: V3;
  ant: V3;
  lat: V3;
}

export interface Skeleton {
  sex: Sex;
  seg: Segments;
  H: number;
  /** Puntos que lee el rig (src/anatomy/rig.ts), lado izquierdo y línea media. */
  L: Record<string, V3>;
  /** Puntos anatómicos de inserción, lado izquierdo y línea media. */
  p: Record<string, V3>;
  limbs: Record<'humerus' | 'forearm' | 'thigh' | 'shank' | 'hand' | 'foot', Limb>;
  /** Mano: eje, palma y dirección radial (pulgar). */
  hand: { axis: V3; palm: V3; radial: V3 };
  /** Falanges: polilíneas articulares por dedo (MCP → punta) y radios. */
  fingers: Record<'i' | 'm' | 'r' | 'p' | 't', { pts: V3[]; r: number[] }>;
}

const deg = Math.PI / 180;

function orth(v: V3, axis: V3): V3 {
  const a = norm(axis);
  const d = v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
  return norm(sub(v, scale(a, d)));
}

function limb(a: V3, b: V3, antHint: V3, latHint: V3): Limb {
  const axis = norm(sub(b, a));
  const ant = orth(antHint, axis);
  let lat = norm(cross(axis, ant));
  // Lado izquierdo: lateral = +X aproximadamente.
  if (lat[0] * latHint[0] + lat[1] * latHint[1] + lat[2] * latHint[2] < 0) lat = scale(lat, -1);
  return { a, b, axis, ant, lat };
}

/** Punto en coordenadas cilíndricas de un segmento: fracción t del eje, ángulo (0 = anterior, 90 = lateral) y radio. */
export function cyl(l: Limb, t: number, angDeg: number, r: number): V3 {
  const c = lerp3(l.a, l.b, t);
  const ca = Math.cos(angDeg * deg);
  const sa = Math.sin(angDeg * deg);
  return [c[0] + r * (ca * l.ant[0] + sa * l.lat[0]), c[1] + r * (ca * l.ant[1] + sa * l.lat[1]), c[2] + r * (ca * l.ant[2] + sa * l.lat[2])];
}

/** Dirección del ángulo en el plano perpendicular al eje del segmento. */
export function cylDir(l: Limb, angDeg: number): V3 {
  const ca = Math.cos(angDeg * deg);
  const sa = Math.sin(angDeg * deg);
  return norm(add(scale(l.ant, ca), scale(l.lat, sa)));
}

export const MODEL_BODY: Record<Sex, { heightCm: number; massKg: number }> = {
  M: { heightCm: 175, massKg: 75 },
  F: { heightCm: 163, massKg: 60 },
};

export function buildSkeleton(sex: Sex): Skeleton {
  const seg = computeSegments({ ...DEFAULT_ANTHRO, ...MODEL_BODY[sex], sex });
  const H = seg.H;
  const F = sex === 'F';
  const L: Record<string, V3> = {};
  const p: Record<string, V3> = {};

  // --- Miembro inferior: muslo y pierna casi verticales; la rodilla un poco por detrás.
  const hh = seg.hipHalfWidth;
  // Postura de reposo en «A» suave (caderas algo abiertas): la piel no une los muslos ni los
  // brazos con el tronco, y el rig no tiene que despegarlos al mover cadera u hombro.
  const dT = norm([F ? 0.03 : 0.05, -1, -0.045]);
  const dS = norm([F ? 0.045 : 0.03, -1, -0.022]);
  const yHip = seg.ankleHeight - (dT[1] * seg.thigh + dS[1] * seg.shank);
  const hjc: V3 = [hh, yHip, 0];
  const knee = add(hjc, scale(dT, seg.thigh));
  const ankle = add(knee, scale(dS, seg.shank));
  const toeOut = 7 * deg;
  const toeDir: V3 = [Math.sin(toeOut), 0, Math.cos(toeOut)];
  const heel: V3 = [ankle[0] - toeDir[0] * seg.heelToAnkle, 0, ankle[2] - toeDir[2] * seg.heelToAnkle];
  const ball = add(heel, scale(toeDir, seg.heelToBall));
  const toe = add(heel, scale(toeDir, seg.footLen));
  Object.assign(L, { hjc, knee, ankle, heel, toe });

  // --- Tronco: la línea de la columna del motor (pivotes de los huesos del rig).
  const hipMid: V3 = [0, yHip, 0];
  const s1 = add(hipMid, [0, seg.s1.y, seg.s1.z]);
  const l1 = add(s1, [0, seg.lumbar, 0]);
  const c7 = add(l1, [0, seg.thoracic, 0]);
  // Cabeza algo más adelantada que el punto «head» del motor: la nuca queda al ras de la espalda.
  const headC: V3 = [0, c7[1] + seg.neck + seg.headAboveNeck, -0.007 * H];
  const top: V3 = [0, headC[1] + seg.headRadius * 0.97, headC[2] - 0.004 * H];
  Object.assign(L, { s1, l1, c7, top });

  // --- Cintura escapular.
  const sc: V3 = [seg.scLeft.x, c7[1] + seg.scLeft.y, s1[2] + seg.scLeft.z];
  const gh = add(sc, [seg.clavicleLeft.x, seg.clavicleLeft.y, seg.clavicleLeft.z]);
  Object.assign(L, { sc, gh });

  // --- Brazo: algo separado del tronco; antebrazo con ángulo de carga y algo adelantado.
  const abd = (F ? 36 : 35) * deg;
  const dUA = norm([Math.sin(abd), -Math.cos(abd), -0.02]);
  const elbow = add(gh, scale(dUA, seg.upperArm));
  // Antebrazo: prolonga el brazo con el ángulo de carga (algo más abierto) y una flexión leve.
  const dFA = norm(add(dUA, [F ? 0.25 : 0.21, 0, 0.17]));
  const wrist = add(elbow, scale(dFA, seg.forearm));
  Object.assign(L, { elbow, wrist });

  // --- Mano: palma al frente, pulgar hacia fuera, dedos algo flexionados.
  const hAx = norm(add(dFA, [0, 0, 0.06]));
  const palm = orth([0, 0, 1], hAx);
  const radial = norm(cross(palm, hAx));
  const hs = H * (F ? 0.97 : 1);
  const palmLen = 0.047 * hs;
  const breadth = 0.05 * hs * (F ? 0.94 : 1);
  const PH = [0.026 * hs, 0.016 * hs, 0.0115 * hs];
  const fingerSpec = {
    i: { off: 0.37, along: 0.97, k: 0.92, splay: 5, r: 0.0094 },
    m: { off: 0.12, along: 1, k: 1, splay: 1, r: 0.0098 },
    r: { off: -0.13, along: 0.965, k: 0.95, splay: -3, r: 0.0092 },
    p: { off: -0.37, along: 0.89, k: 0.77, splay: -8, r: 0.0082 },
  } as const;
  const curl = [12, 18, 10];
  const fingers = {} as Skeleton['fingers'];
  const rotToward = (d: V3, toward: V3, angDeg: number) => norm(add(scale(d, Math.cos(angDeg * deg)), scale(toward, Math.sin(angDeg * deg))));
  for (const [f, s] of Object.entries(fingerSpec) as Array<[keyof typeof fingerSpec, (typeof fingerSpec)['i']]>) {
    const mcp = add(add(wrist, scale(hAx, palmLen * s.along)), add(scale(radial, breadth * s.off), scale(palm, f === 'm' ? 0 : 0.003 * hs)));
    const pts: V3[] = [mcp];
    const d = rotToward(hAx, radial, s.splay);
    let acc = 0;
    for (let j = 0; j < 3; j++) {
      acc += curl[j]!;
      const dj = rotToward(d, palm, acc);
      pts.push(add(pts[j]!, scale(dj, PH[j]! * s.k)));
    }
    L[`${f}0`] = pts[0]!;
    L[`${f}1`] = pts[1]!;
    L[`${f}2`] = pts[2]!;
    L[`${f}3`] = pts[3]!;
    const r = s.r * (hs / 1.75) * (F ? 0.94 : 1);
    fingers[f] = { pts, r: [r, r * 0.92, r * 0.84, r * 0.74] };
  }
  // Pulgar: base en el carpo (radial y palmar), metacarpiano, falange proximal y distal.
  const cmc = add(add(wrist, scale(hAx, 0.012 * hs)), add(scale(radial, 0.016 * hs), scale(palm, 0.008 * hs)));
  const tDir0 = norm(add(add(scale(hAx, 0.72), scale(radial, 0.45)), scale(palm, 0.52)));
  const t0 = add(cmc, scale(tDir0, 0.026 * hs));
  const tDir1 = norm(add(add(scale(hAx, 0.86), scale(radial, 0.22)), scale(palm, 0.46)));
  const t1 = add(t0, scale(tDir1, 0.019 * hs));
  const tDir2 = norm(add(add(scale(hAx, 0.9), scale(radial, 0.12)), scale(palm, 0.42)));
  const t2 = add(t1, scale(tDir2, 0.017 * hs));
  Object.assign(L, { t0, t1, t2 });
  const tr = 0.0108 * (hs / 1.75) * (F ? 0.94 : 1);
  fingers.t = { pts: [cmc, t0, t1, t2], r: [tr * 1.25, tr, tr * 0.92, tr * 0.78] };

  // --- Puntos anatómicos (inserciones), lado izquierdo y línea media.
  const depthSc = F ? 0.96 : 1;
  Object.assign(p, {
    hipMid,
    pubis: [0, yHip - 0.012 * H, 0.062 * H * depthSc],
    asis: [0.07 * H * (F ? 1.08 : 1), yHip + 0.05 * H, 0.05 * H],
    iliacTop: [0.083 * H * (F ? 1.06 : 1), yHip + 0.075 * H, -0.004 * H],
    psis: [0.025 * H, yHip + 0.06 * H, -0.062 * H],
    sacrum: [0, yHip + 0.025 * H, -0.07 * H],
    coccyx: [0, yHip - 0.022 * H, -0.06 * H],
    ischium: [0.034 * H, yHip - 0.045 * H, -0.035 * H],
    trochanter: [hh + 0.026 * H * (F ? 1.05 : 1), yHip - 0.006 * H, -0.004 * H],
    jugular: [0, c7[1] - 0.036 * H, 0.05 * H],
    sternumMid: [0, c7[1] - 0.105 * H, 0.068 * H * depthSc],
    xiphoid: [0, c7[1] - 0.17 * H, 0.066 * H * depthSc],
    navel: [0, yHip + 0.105 * H, 0.06 * H],
    acromion: [gh[0] + 0.006 * H, gh[1] + 0.017 * H, gh[2] - 0.004 * H],
    coracoid: [gh[0] - 0.02 * H, gh[1] + 0.003 * H, gh[2] + 0.024 * H],
    clavMid: lerp3(sc, [gh[0], gh[1] + 0.015 * H, gh[2] + 0.01 * H], 0.5),
    scapSpineRoot: [0.05 * H, c7[1] - 0.045 * H, -0.05 * H],
    scapSupAngle: [0.048 * H, c7[1] - 0.008 * H, -0.046 * H],
    scapInfAngle: [0.056 * H, c7[1] - 0.122 * H, -0.048 * H],
    scapLatBorder: [0.086 * H, c7[1] - 0.085 * H, -0.036 * H],
    occiput: [0, headC[1] - 0.012 * H, headC[2] - 0.05 * H],
    mastoid: [0.04 * H, headC[1] - 0.018 * H, headC[2] - 0.012 * H],
    chin: [0, headC[1] - 0.067 * H, headC[2] + 0.052 * H],
    headC,
  } satisfies Record<string, V3>);
  // Columna posterior (apófisis espinosas) en función de la altura.
  p.spT1 = [0, c7[1] - 0.012 * H, c7[2] - 0.034 * H];
  p.spT6 = [0, c7[1] - 0.085 * H, c7[2] - 0.03 * H];
  p.spT12 = [0, l1[1] + 0.012 * H, l1[2] - 0.02 * H];
  p.spL3 = [0, s1[1] + 0.05 * H, s1[2] - 0.022 * H];
  p.spC4 = [0, c7[1] + 0.035 * H, c7[2] - 0.006 * H];

  // --- Ejes de segmento para coordenadas cilíndricas.
  const X: V3 = [1, 0, 0];
  const Z: V3 = [0, 0, 1];
  const limbs: Skeleton['limbs'] = {
    humerus: limb(gh, elbow, Z, X),
    forearm: limb(elbow, wrist, palm, radial),
    thigh: limb(hjc, knee, Z, X),
    shank: limb(knee, ankle, toeDir, X),
    hand: limb(wrist, L.m0!, palm, radial),
    foot: limb(heel, toe, [0, 1, 0], X),
  };
  p.ball = ball;
  p.latEpi = cyl(limbs.humerus, 0.98, 95, 0.021 * H);
  p.medEpi = cyl(limbs.humerus, 0.98, 270, 0.026 * H);
  p.olecranon = cyl(limbs.forearm, 0.02, 180, 0.012 * H);
  p.radStyloid = cyl(limbs.forearm, 1, 90, 0.013 * H);
  p.ulnStyloid = cyl(limbs.forearm, 1, 250, 0.012 * H);
  p.patella = cyl(limbs.thigh, 0.97, 0, 0.034 * H);
  p.tibTub = cyl(limbs.shank, 0.09, 0, 0.022 * H);
  p.fibHead = cyl(limbs.shank, 0.06, 110, 0.023 * H);
  p.medMall = cyl(limbs.shank, 1, 270, 0.017 * H);
  p.latMall = cyl(limbs.shank, 1.02, 100, 0.017 * H);
  p.calcaneus = add(heel, [0, 0.025 * H, 0.0]);

  return { sex, seg, H, L, p, limbs, hand: { axis: hAx, palm, radial }, fingers };
}
