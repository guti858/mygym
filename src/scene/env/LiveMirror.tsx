import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, type RefObject } from 'react';
import { Color, Matrix4, OrthographicCamera, ShaderMaterial, Vector3, WebGLRenderTarget, type Light, type Object3D, type Plane, type Texture } from 'three';

/**
 * Reflejo vivo en los espejos de la sala de estación (decisión E3 del acta, capa opcional).
 *
 * Una cámara virtual, reflejo de la de la escena en el plano de las lunas, pinta solo la máquina y el
 * avatar (capa REFLECT_LAYER) en una textura a media resolución; las lunas la proyectan encima de su
 * reflejo horneado. Con cámara ortográfica basta con reflejar posición, dirección y «arriba»: cada
 * punto de la luna se busca en la imagen de la cámara virtual (matriz de proyección de textura).
 * Cuesta un segundo render de máquina y avatar por fotograma, por eso va apagado por defecto.
 */

export const REFLECT_LAYER = 3;

export interface MirrorLink {
  /** Plano de las lunas (mundo), hacia la sala. Lo pone BakedRoom al montar la sala. */
  plane: Plane | null;
  /** La pared de los espejos se ve (no está desvanecida del todo). */
  visible: boolean;
  uniforms: { map: { value: Texture | null }; textureMatrix: { value: Matrix4 }; fade: { value: number } };
}

export function createMirrorLink(): MirrorLink {
  return { plane: null, visible: false, uniforms: { map: { value: null }, textureMatrix: { value: new Matrix4() }, fade: { value: 1 } } };
}

/** Material de la capa que se pinta sobre cada luna (comparte los uniformes del enlace). */
export function mirrorOverlayMaterial(link: MirrorLink): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: link.uniforms,
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      varying vec4 vProj;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vProj = textureMatrix * world;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float fade;
      varying vec4 vProj;
      void main() {
        vec4 c = texture2DProj(map, vProj);
        // Un espejo de gimnasio no es perfecto: algo más oscuro y un punto translúcido.
        gl_FragColor = vec4(c.rgb * 0.82, c.a * 0.9 * fade);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
}

/** Sesgo de [-1, 1] a [0, 1] para pasar de coordenadas de recorte a coordenadas de textura. */
const BIAS = new Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

export function LiveMirror({ link, subjects }: { link: MirrorLink; subjects: readonly RefObject<Object3D | null>[] }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const rt = useMemo(() => new WebGLRenderTarget(1, 1), []);
  const virtual = useMemo(() => new OrthographicCamera(), []);
  useEffect(
    () => () => {
      rt.dispose();
      link.uniforms.map.value = null;
    },
    [rt, link],
  );
  useFrame((state) => {
    const plane = link.plane;
    if (!plane || !link.visible) return;
    const cam = state.camera as OrthographicCamera;
    const w = Math.max(1, Math.round(gl.domElement.width / 2));
    const h = Math.max(1, Math.round(gl.domElement.height / 2));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    // Solo máquina y avatar (y las luces, que también se filtran por capas).
    for (const s of subjects) s.current?.traverse((o) => o.layers.enable(REFLECT_LAYER));
    scene.traverse((o) => {
      if ((o as Light).isLight) o.layers.enable(REFLECT_LAYER);
    });
    // Cámara reflejada en el plano de las lunas.
    const reflect = (p: Vector3) => p.clone().sub(plane.normal.clone().multiplyScalar(2 * plane.distanceToPoint(p)));
    const dir = cam.getWorldDirection(new Vector3());
    virtual.left = cam.left;
    virtual.right = cam.right;
    virtual.top = cam.top;
    virtual.bottom = cam.bottom;
    virtual.near = cam.near;
    virtual.far = cam.far;
    virtual.zoom = cam.zoom;
    virtual.position.copy(reflect(cam.position));
    virtual.up.copy(cam.up).reflect(plane.normal);
    virtual.lookAt(reflect(cam.position.clone().add(dir)));
    virtual.updateProjectionMatrix();
    virtual.updateMatrixWorld();
    virtual.layers.set(REFLECT_LAYER);
    link.uniforms.textureMatrix.value.copy(BIAS).multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
    // Render a la textura, con fondo transparente y sin recalcular sombras.
    const background = scene.background;
    const autoShadows = gl.shadowMap.autoUpdate;
    const prevTarget = gl.getRenderTarget();
    const prevColor = gl.getClearColor(new Color());
    const prevAlpha = gl.getClearAlpha();
    scene.background = null;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, virtual);
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevColor, prevAlpha);
    gl.shadowMap.autoUpdate = autoShadows;
    scene.background = background;
    link.uniforms.map.value = rt.texture;
  });
  return null;
}
