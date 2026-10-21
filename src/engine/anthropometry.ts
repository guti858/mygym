import { Vector3 } from 'three';
import { clamp } from './math';

/**
 * Antropometría del usuario. Las longitudes de segmento se derivan de la talla con los
 * cocientes de Winter (Biomechanics and Motor Control of Human Movement) y se ajustan con
 * los factores de proporción.
 */
export type Sex = 'M' | 'F';

export interface Anthropometry {
  /** Modelo corporal: proporciones de anchura y perímetros (las longitudes salen de la talla). */
  sex: Sex;
  heightCm: number;
  massKg: number;
  /** Multiplicador de brazo + antebrazo (0,94–1,06). */
  armRatio: number;
  /** Multiplicador de fémur (0,94–1,06). */
  femurRatio: number;
  /** Multiplicador de tronco (0,94–1,06). */
  torsoRatio: number;
  /** Flexión de cadera máxima funcional antes de que la pelvis bascule (grados). */
  hipFlexionMax: number;
  /** Flexión dorsal de tobillo máxima con rodilla flexionada (grados). */
  ankleDorsiMax: number;
}

export const DEFAULT_ANTHRO: Anthropometry = {
  sex: 'M',
  heightCm: 175,
  massKg: 75,
  armRatio: 1,
  femurRatio: 1,
  torsoRatio: 1,
  hipFlexionMax: 120,
  ankleDorsiMax: 40,
};

/** Perfiles extremos usados en los tests de alcance (P5 mujer – P95 hombre, con proporciones extremas). */
export const ANTHRO_TEST_PROFILES: Record<string, Anthropometry> = {
  p5: { ...DEFAULT_ANTHRO, sex: 'F', heightCm: 150, massKg: 48 },
  p50: DEFAULT_ANTHRO,
  mujer: { ...DEFAULT_ANTHRO, sex: 'F', heightCm: 163, massKg: 60 },
  p95: { ...DEFAULT_ANTHRO, heightCm: 195, massKg: 100 },
  femurLargo: { ...DEFAULT_ANTHRO, heightCm: 182, femurRatio: 1.06, torsoRatio: 0.95 },
  brazosCortos: { ...DEFAULT_ANTHRO, heightCm: 165, armRatio: 0.94 },
  brazosLargos: { ...DEFAULT_ANTHRO, heightCm: 188, armRatio: 1.06 },
  rigido: { ...DEFAULT_ANTHRO, hipFlexionMax: 100, ankleDorsiMax: 28 },
};

export interface Segments {
  H: number;
  /** Factor de complexión (√(IMC/22,5), acotado): escala perímetros y volúmenes. */
  build: number;
  // Miembro inferior
  thigh: number;
  shank: number;
  footLen: number;
  ankleHeight: number;
  /** Distancia horizontal talón → proyección del tobillo. */
  heelToAnkle: number;
  /** Distancia talón → cabeza de los metatarsianos (bola del pie). */
  heelToBall: number;
  hipHalfWidth: number;
  // Pelvis y tronco (en el sistema de la pelvis / tórax)
  s1: Vector3;
  ischium: Vector3;
  lumbar: number;
  thoracic: number;
  neck: number;
  headAboveNeck: number;
  headRadius: number;
  /** Articulación esternoclavicular izquierda, relativa a C7 en el sistema del tórax. */
  scLeft: Vector3;
  /** Vector clavícula (SC → centro glenohumeral) del lado izquierdo, en reposo. */
  clavicleLeft: Vector3;
  // Miembro superior
  upperArm: number;
  forearm: number;
  hand: number;
  // Volúmenes (radios para render y contactos)
  r: {
    upperArm: number;
    forearm: number;
    thigh: number;
    shank: number;
    neck: number;
    thoraxHalfWidth: number;
    thoraxFront: number;
    thoraxBack: number;
    pelvisHalfWidth: number;
    pelvisDepth: number;
  };
}

export function bmi(a: Anthropometry): number {
  const h = a.heightCm / 100;
  return a.massKg / (h * h);
}

/**
 * Diferencias de anchura y perímetro de la mujer respecto al hombre a igual talla (medias de
 * ANSUR II normalizadas por la estatura): cadera más ancha, tórax y brazos algo más estrechos.
 */
const SEX_WIDTH: Record<Sex, { clavicle: number; hip: number; thorax: number; pelvis: number; arm: number; forearm: number; thigh: number; neck: number }> = {
  M: { clavicle: 1, hip: 1, thorax: 1, pelvis: 1, arm: 1, forearm: 1, thigh: 1, neck: 1 },
  F: { clavicle: 0.97, hip: 1.07, thorax: 0.94, pelvis: 1.1, arm: 0.95, forearm: 0.93, thigh: 1.03, neck: 0.9 },
};

export function computeSegments(a: Anthropometry): Segments {
  const H = a.heightCm / 100;
  const k = clamp(Math.sqrt(bmi(a) / 22.5), 0.85, 1.35);
  const w = SEX_WIDTH[a.sex] ?? SEX_WIDTH.M;
  const thigh = 0.245 * H * a.femurRatio;
  const shank = 0.246 * H;
  const footLen = 0.152 * H;
  return {
    H,
    build: k,
    thigh,
    shank,
    footLen,
    ankleHeight: 0.039 * H,
    heelToAnkle: 0.25 * footLen,
    heelToBall: 0.73 * footLen,
    hipHalfWidth: 0.0475 * H * w.hip,
    s1: new Vector3(0, 0.055 * H, -0.045 * H),
    ischium: new Vector3(0, -0.055 * H, -0.03 * H),
    lumbar: 0.095 * H * a.torsoRatio,
    thoracic: 0.145 * H * a.torsoRatio,
    neck: 0.05 * H,
    headAboveNeck: 0.055 * H,
    headRadius: 0.064 * H,
    scLeft: new Vector3(0.012 * H, -0.03 * H, 0.085 * H),
    clavicleLeft: new Vector3(0.093 * H * w.clavicle, 0, -0.045 * H),
    upperArm: 0.186 * H * a.armRatio,
    forearm: 0.146 * H * a.armRatio,
    hand: 0.055 * H,
    r: {
      upperArm: 0.025 * H * k * w.arm,
      forearm: 0.019 * H * k * w.forearm,
      thigh: 0.04 * H * k * w.thigh,
      shank: 0.027 * H * k,
      neck: 0.03 * H * k * w.neck,
      thoraxHalfWidth: 0.085 * H * Math.sqrt(k) * w.thorax,
      thoraxFront: 0.1 * H * k,
      thoraxBack: 0.035 * H * k,
      pelvisHalfWidth: 0.09 * H * k * w.pelvis,
      pelvisDepth: 0.07 * H * k,
    },
  };
}
