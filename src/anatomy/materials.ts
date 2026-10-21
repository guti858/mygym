import { Color, FrontSide, MeshStandardMaterial, Vector2, Vector3, type WebGLProgramParametersWithUniforms } from 'three';

/**
 * Materiales del modelo anatómico. Todo lo opaco del cuerpo es UNA malla: el color, el brillo y el
 * abultamiento de cada región (músculo del catálogo, tendón, capa profunda, guantes...) salen de
 * tablas de uniformes indexadas por el atributo `region`. Cambiar qué músculos trabajan es escribir
 * unos pocos uniformes: sin materiales por pieza, sin recompilar y con una sola llamada de dibujo.
 */

/** Tamaño fijo de las tablas (mismo programa de GPU para todos los avatares). */
export const MAX_REGIONS = 40;

export interface BodyUniforms {
  /** Color base por región. */
  color: Vector3[];
  /** Emisión (color × intensidad) por región. */
  glow: Vector3[];
  /** x: abultamiento máximo (m) en el centro del vientre muscular; y: rugosidad. */
  fx: Vector2[];
}

const BODY_VERT_PARS = /* glsl */ `
attribute float region;
attribute float aux;
uniform vec3 uRegionColor[${MAX_REGIONS}];
uniform vec3 uRegionGlow[${MAX_REGIONS}];
uniform vec2 uRegionFx[${MAX_REGIONS}];
varying vec3 vRegColor;
varying vec3 vRegGlow;
varying float vRough;
`;

const BODY_FRAG_PARS = /* glsl */ `
varying vec3 vRegColor;
varying vec3 vRegGlow;
varying float vRough;
`;

function bodyCompile(shader: WebGLProgramParametersWithUniforms, u: BodyUniforms) {
  shader.uniforms.uRegionColor = { value: u.color };
  shader.uniforms.uRegionGlow = { value: u.glow };
  shader.uniforms.uRegionFx = { value: u.fx };
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${BODY_VERT_PARS}`).replace(
    '#include <begin_vertex>',
    /* glsl */ `#include <begin_vertex>
      int rid = int(region + 0.5);
      vRegColor = uRegionColor[rid];
      vRegGlow = uRegionGlow[rid];
      vRough = uRegionFx[rid].y;
      // Contracción: el vientre muscular se ensancha a lo largo de su normal (antes del skinning).
      transformed += normal * (aux * uRegionFx[rid].x);`,
  );
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${BODY_FRAG_PARS}`)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( vRegColor, opacity );')
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vRegGlow;')
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n\troughnessFactor = vRough;');
}

export function createBodyMaterial(): { material: MeshStandardMaterial; uniforms: BodyUniforms } {
  const uniforms: BodyUniforms = {
    color: Array.from({ length: MAX_REGIONS }, () => new Vector3(0.6, 0.4, 0.4)),
    glow: Array.from({ length: MAX_REGIONS }, () => new Vector3()),
    fx: Array.from({ length: MAX_REGIONS }, () => new Vector2(0, 0.55)),
  };
  const material = new MeshStandardMaterial({ metalness: 0, roughness: 0.55 });
  material.onBeforeCompile = (shader) => bodyCompile(shader, uniforms);
  // Mismo programa para todos los cuerpos (las tablas van en uniformes propios de cada material).
  material.customProgramCacheKey = () => 'anatomy-body';
  return { material, uniforms };
}

export interface SkinUniforms {
  /** Opacidad de frente y en el contorno (efecto Fresnel). */
  opacity: { value: number };
  rim: { value: number };
  /** 1 = piel opaca en todo el cuerpo (vista sin músculos). */
  solid: { value: number };
}

/**
 * Piel envolvente: translúcida (deja ver los músculos) con el contorno más marcado; la cabeza es
 * opaca (atributo `aux`). Siempre en la cola transparente; para la vista sin músculos basta con
 * `solid` = 1 y escribir profundidad, sin cambiar de programa.
 */
export function createSkinMaterial(): { material: MeshStandardMaterial; uniforms: SkinUniforms } {
  const uniforms: SkinUniforms = { opacity: { value: 0.16 }, rim: { value: 0.62 }, solid: { value: 0 } };
  const material = new MeshStandardMaterial({ metalness: 0, roughness: 0.6, transparent: true, depthWrite: false, side: FrontSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkinOpacity = uniforms.opacity;
    shader.uniforms.uSkinRim = uniforms.rim;
    shader.uniforms.uSkinSolid = uniforms.solid;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aux;\nvarying float vVeil;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvVeil = aux;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vVeil;\nuniform float uSkinOpacity;\nuniform float uSkinRim;\nuniform float uSkinSolid;')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `float skinFres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
        diffuseColor.a = mix(mix(uSkinOpacity, uSkinRim, skinFres), 1.0, max(vVeil, uSkinSolid));
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'anatomy-skin';
  return { material, uniforms };
}

const tmp = new Color();

/** Color de tema → vector lineal (los uniformes no pasan por la conversión de color de three.js). */
export function setLinear(v: Vector3, css: string | Color, k = 1): Vector3 {
  tmp.set(css);
  return v.set(tmp.r * k, tmp.g * k, tmp.b * k);
}
