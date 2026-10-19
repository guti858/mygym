import { Vector3 } from 'three';
import { SIDES, sideSign, solveBody, type AxialParams, type FootTarget, type HandTarget, type Side } from '../../engine/body';
import { describeLoad, platesPerSide, type LoadSpec } from '../../engine/load';
import { DEG, Frame, lerp, qAxis } from '../../engine/math';
import type { ContactForce } from '../../engine/moments';
import type { Segments } from '../../engine/anthropometry';
import type { StationFrameInput, StationLogic, StationSolution } from '../../engine/types';
import { axialAt, reachFor, upperBackPoint, type AxialKeys } from '../common';

/**
 * Press de banca plano con barra libre. El usuario está tumbado (cabeza hacia −Z, cara hacia
 * arriba), con la espalda alta y los glúteos en el banco y los pies en el suelo. La barra sigue
 * una trayectoria en «J»: del esternón bajo a la vertical de los hombros.
 */

export interface BancaMachine {
  bar: Vector3;
  platesPerSide: number[];
  /** Altura de los soportes (J) y de los brazos de seguridad. */
  hookY: number;
  safetyY: number;
  benchTop: number;
}

interface VariantGeom {
  /** Media separación entre manos, fracción de la talla. */
  halfGripH: number;
  /** Abducción de los codos buscada abajo (grados respecto al tronco). */
  elbowAbd: number;
}

const GEOM: Record<string, VariantGeom> = {
  medio: { halfGripH: 0.165, elbowAbd: 58 },
  cerrado: { halfGripH: 0.11, elbowAbd: 30 },
  ancho: { halfGripH: 0.205, elbowAbd: 68 },
};

export const BENCH_TOP = 0.44;
/** Altura de los montantes del soporte. */
export const BANCA_UPRIGHT_TOP = 1.56;
/** El hombro queda en z ≈ 0 (los soportes de la barra, a la altura de los ojos). */
const GH_Z = 0;
const TOP_FLEX = 12;

export const BANCA_LOAD: LoadSpec = { kind: 'discos', baseKg: 20, base: 'barra', maxPlatesKgPerSide: 100, effectiveFactor: 1, label: 'Barra olímpica + discos' };

const AXIAL_KEYS: AxialKeys = {
  scapProt: [{ p: 0, v: -20 }],
  scapElev: [{ p: 0, v: -6 }],
  lumbarFlex: [{ p: 0, v: -12 }],
  thoracicFlex: [{ p: 0, v: -6 }],
  neckFlex: [{ p: 0, v: 0 }],
  wristExt: [
    { p: 0, v: 12 },
    { p: 1, v: 8 },
  ],
};

function axialFor(p: number, errorId: string | null): AxialParams {
  const over: Partial<AxialParams> = {};
  if (errorId === 'escapulas_sueltas') over.scapProt = lerp(-4, 14, p);
  else if (errorId === 'munecas') over.wristExt = 44;
  else if (errorId === 'gluteos') over.lumbarFlex = lerp(-30, -27, p);
  return axialAt(AXIAL_KEYS, p, over);
}

/**
 * Tórax paralelo al banco (o con la cabeza `bridgeDeg` más baja si se hace puente): la pelvis
 * compensa la extensión lumbar y torácica (arco).
 */
function supineQuat(axial: AxialParams, bridgeDeg: number) {
  return qAxis(new Vector3(1, 0, 0), -90 - bridgeDeg - axial.lumbarFlex - axial.thoracicFlex);
}

/** Pies apoyados en el suelo a ambos lados del banco, rodillas hacia arriba. */
function benchFeet(seg: Segments, pelvis: Frame): Record<Side, FootTarget> {
  const out = {} as Record<Side, FootTarget>;
  for (const side of SIDES) {
    const s = sideSign(side);
    const hjc = pelvis.point(s * seg.hipHalfWidth, 0, 0);
    const ankleX = s * Math.max(0.22, seg.hipHalfWidth + 0.13);
    const ankleY = seg.ankleHeight;
    // Tibia algo inclinada hacia atrás: rodilla por delante del tobillo.
    const kneeY = ankleY + seg.shank * 0.97;
    const dx = ankleX - hjc.x;
    const dy = kneeY - hjc.y;
    const dzThigh = Math.sqrt(Math.max(0.01, seg.thigh ** 2 * 0.99 - dx * dx - dy * dy));
    const ankleZ = hjc.z + dzThigh - seg.shank * 0.24;
    const toeDir = new Vector3(s * Math.sin(18 * DEG), 0, Math.cos(18 * DEG));
    out[side] = {
      heel: new Vector3(ankleX, 0, ankleZ).sub(toeDir.clone().multiplyScalar(seg.heelToAnkle)),
      toeDir,
      up: new Vector3(0, 1, 0),
      kneePole: new Vector3(s * 0.25, 1, 0.5),
      heelLiftAllowed: false,
    };
  }
  return out;
}

/**
 * Coloca el cuerpo tumbado: espalda alta sobre el banco y hombros en z = GH_Z. Los pies se apoyan
 * donde los dejaría la postura correcta (no se mueven al hacer puente).
 */
function placeSupine(
  seg: Segments,
  anthro: StationFrameInput['anthro'],
  axial: AxialParams,
  bridgeDeg: number,
): { pelvis: Frame; feet: Record<Side, FootTarget> } {
  const base = bridgeDeg !== 0 ? placeSupine(seg, anthro, axialAt(AXIAL_KEYS, 0.5), 0) : null;
  const q = supineQuat(axial, bridgeDeg);
  const probe = new Frame(new Vector3(), q);
  const feet0 = benchFeet(seg, probe);
  const body0 = solveBody({ seg, anthro, pelvisRef: probe, pelvisPivot: new Vector3(), axial, feet: feet0 });
  const back = upperBackPoint(body0);
  const ghZ = (body0.arms.L.gh.z + body0.arms.R.gh.z) / 2;
  const shift = new Vector3(0, BENCH_TOP - back.y, GH_Z - ghZ);
  const pelvis = new Frame(shift.clone(), q);
  return { pelvis, feet: base ? base.feet : benchFeet(seg, pelvis) };
}

export const bancaLogic: StationLogic<BancaMachine> = {
  id: 'press_banca',
  // El usuario mira hacia arriba; la referencia horizontal solo afecta a la inclinación del tronco (no se usa aquí).
  forward: new Vector3(0, 0, -1),
  startAt: 'contraccion',
  load: BANCA_LOAD,
  defaultLoadKg: 40,
  bounds: { min: [-1.25, 0, -0.75], max: [1.25, 1.6, 1.1] },
  framePoints: (m) => [
    new Vector3(1.2, 0, -0.5),
    new Vector3(-1.2, 0, -0.5),
    new Vector3(0.6, 0, 1.05),
    new Vector3(-0.6, 0, 1.05),
    // Parte alta de los soportes (montantes de 1,55 m).
    new Vector3(0.62, BANCA_UPRIGHT_TOP, -0.12),
    new Vector3(-0.62, BANCA_UPRIGHT_TOP, -0.12),
    // Discos (radio máx. 0,225 m en el plano YZ) en los dos extremos de la barra.
    ...[1.1, -1.1].flatMap((x) => [m.bar.clone().add(new Vector3(x, 0.24, -0.24)), m.bar.clone().add(new Vector3(x, 0.24, 0.24))]),
  ],
  solve(input: StationFrameInput): StationSolution<BancaMachine> {
    const { seg, anthro, p, errorId } = input;
    const geom = GEOM[input.variantId] ?? GEOM.medio!;
    // Puente de glúteos: la espalda alta sigue en el banco y el tronco bascula con la cabeza más baja.
    const bridge = errorId === 'gluteos' ? lerp(26, 21, p) : 0;
    const axP = axialFor(p, errorId);
    const ref1 = placeSupine(seg, anthro, axialFor(1, errorId), bridge);
    const top = solveBody({ seg, anthro, pelvisRef: ref1.pelvis, pelvisPivot: new Vector3(), axial: axialFor(1, errorId), feet: ref1.feet });
    const ref0 = placeSupine(seg, anthro, axialFor(0, errorId), bridge);
    const bottom = solveBody({ seg, anthro, pelvisRef: ref0.pelvis, pelvisPivot: new Vector3(), axial: axialFor(0, errorId), feet: ref0.feet });

    const halfGrip = geom.halfGripH * seg.H;
    // Arriba: barra sobre la vertical de los hombros con los codos casi extendidos.
    const gh1 = top.arms.L.gh;
    const reach = reachFor(seg, TOP_FLEX, top.axial.wristExt);
    const dx = halfGrip - Math.abs(gh1.x);
    const barTop = new Vector3(0, gh1.y + Math.sqrt(Math.max(0.04, reach * reach - dx * dx)), gh1.z);
    // Abajo: contacto con el esternón bajo (o con el cuello alto si se demuestra ese error).
    const chest = 0.118 * seg.H * Math.pow(seg.build, 0.8);
    const touch = errorId === 'barra_cuello' ? 0.9 : 0.4;
    const barBottom = bottom.thorax.point(0, touch * seg.thoracic, chest + 0.03);
    barBottom.x = 0;
    // Trayectoria en J: al subir, la barra vuelve antes hacia los hombros y después sube recta.
    const bar = new Vector3(0, lerp(barBottom.y, barTop.y, p), lerp(barBottom.z, barTop.z, 1 - Math.pow(1 - p, 2.2)));

    const ref = placeSupine(seg, anthro, axP, bridge);
    const pre = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: new Vector3(), axial: axP, feet: ref.feet });
    const abd = (errorId === 'codos_90' || errorId === 'barra_cuello' ? 88 : geom.elbowAbd) * DEG;
    const hands = {} as Record<Side, HandTarget>;
    for (const side of SIDES) {
      const s = sideSign(side);
      const grip = bar.clone().add(new Vector3(s * halfGrip, 0, 0));
      const pole = pre.thorax.dir(s * Math.sin(abd), -Math.cos(abd), -0.9);
      hands[side] = { grip, pole: pole.normalize(), palm: pre.thorax.dir(0, -1, 0.15).normalize() };
    }
    const body = solveBody({ seg, anthro, pelvisRef: ref.pelvis, pelvisPivot: new Vector3(), axial: axP, feet: ref.feet, hands });

    const load = describeLoad(BANCA_LOAD, input.loadKg);
    const forces: ContactForce[] = SIDES.map((side) => ({
      limb: 'arm',
      side,
      point: hands[side].grip.clone(),
      force: new Vector3(0, -load.forceN / 2, 0),
    }));
    const hookY = barTop.y - 0.06;
    const safetyY = barBottom.y - 0.05;
    return {
      body,
      machine: { bar, platesPerSide: platesPerSide(input.loadKg / 2), hookY, safetyY, benchTop: BENCH_TOP },
      forces,
      setup: [
        { label: 'Banco', value: 'Tumbado con los ojos bajo la barra', note: 'Glúteos y espalda alta en el banco; pies firmes en el suelo' },
        { label: 'Soportes', value: `${Math.round(hookY * 100)} cm del suelo`, note: 'Un poco por debajo de la barra con los brazos extendidos' },
        { label: 'Brazos de seguridad', value: `${Math.round(safetyY * 100)} cm del suelo`, note: 'Justo por debajo de la barra apoyada en el pecho' },
        { label: 'Agarre', value: `${Math.round(2 * halfGrip * 100)} cm entre manos`, note: 'Muñecas apiladas sobre los codos' },
        { label: 'Carga', value: load.detail },
      ],
    };
  },
};
