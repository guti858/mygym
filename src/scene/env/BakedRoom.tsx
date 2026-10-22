import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useWarmReveal } from '../warm';
import { BufferAttribute, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, Plane, Vector3, type Material, type Object3D } from 'three';
import { mirrorTexture } from '../GymRoom';
import type { ScenePalette } from '../palette';
import type { BakedRoomAsset } from './environment';
import { mirrorOverlayMaterial, type MirrorLink } from './LiveMirror';
import { isWallKey, parseMaterialName, slotColor, wallOpacity, type WallKey } from './roomMaterials';

/**
 * Sala generada con Blender. La luz viene horneada (atlas o color de vértice), así que sus
 * materiales son MeshBasicMaterial: color del tema × textura de detalle × luz horneada, sin coste
 * de iluminación en tiempo real. Las paredes que se interponen entre la cámara y la máquina se
 * desvanecen con el azimut; las sombras de la máquina y del avatar caen sobre un plano receptor.
 */

interface FadeGroup {
  key: WallKey;
  objects: Object3D[];
  materials: Material[];
}

/** El reflejo horneado de los espejos guarda la mediana en 0,5 (build_rooms.py: bake_reflections). */
const MIRROR_RANGE = 2;
/** Opacidad del vidrio de ventanas y puertas: deja ver el exterior que hay detrás. */
const GLASS_OPACITY = 0.3;

function roomMaterial(src: MeshStandardMaterial, palette: ScenePalette, range: number, vertexLit: boolean, light: number): Material {
  const { slot, mode } = parseMaterialName(src.name);
  const color = new Color(slotColor(palette, slot));
  // Espejo: luna con degradado y, encima, lo que refleja la sala (horneado en Blender; un reflejo en
  // tiempo real costaría otro render de la escena).
  if (slot === 'mirror') {
    const m = new MeshBasicMaterial({ map: mirrorTexture(palette) });
    if (src.emissiveMap) {
      m.lightMap = src.emissiveMap;
      m.lightMapIntensity = Math.PI * MIRROR_RANGE * light;
    }
    return m;
  }
  // Vidrio: translúcido y algo más claro que el exterior (brillo del cristal).
  if (slot === 'window' && mode === 'none') {
    const m = new MeshBasicMaterial({ color: color.lerp(new Color('#ffffff'), 0.35), transparent: true, opacity: GLASS_OPACITY, depthWrite: false });
    m.userData.baseOpacity = GLASS_OPACITY;
    return m;
  }
  // Vidrio macizo (atrezo) y tiras LED: luz propia, sin tono de cámara en el LED para que brille.
  if (slot === 'window' || slot === 'led') return new MeshBasicMaterial({ color, toneMapped: slot !== 'led' });
  const m = new MeshBasicMaterial({ color, map: src.map, side: src.side });
  if (m.map) m.map.anisotropy = 8;
  if (mode === 'atlas' && src.emissiveMap) {
    // MeshBasicMaterial divide el atlas entre π: se compensa y se deshace la normalización.
    m.lightMap = src.emissiveMap;
    m.lightMapIntensity = Math.PI * range;
  } else if (mode === 'vertex' && vertexLit) {
    m.vertexColors = true;
    m.color.multiplyScalar(range);
  }
  return m;
}

/** UV de cada luna de espejo ajustadas a su rectángulo (la textura tiene los reflejos dibujados). */
function fitMirrorUv(mesh: Mesh) {
  const g = mesh.geometry;
  if (g.userData.mirrorUv) return;
  g.computeBoundingBox();
  const { min, max } = g.boundingBox!;
  const pos = g.getAttribute('position');
  // El espejo es plano: su eje horizontal es el más largo de X y Z.
  const alongX = max.x - min.x > max.z - min.z;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const h = alongX ? (pos.getX(i) - min.x) / (max.x - min.x) : (pos.getZ(i) - min.z) / (max.z - min.z);
    uv[i * 2] = h;
    uv[i * 2 + 1] = (pos.getY(i) - min.y) / (max.y - min.y);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.userData.mirrorUv = true;
}

function instantiate(asset: BakedRoomAsset, palette: ScenePalette, light: number) {
  const root = asset.root.clone(true);
  const groups = new Map<WallKey, FadeGroup>();
  const made: Material[] = [];
  const mirrors: { mesh: Mesh; key: WallKey | null }[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as MeshStandardMaterial;
    if (parseMaterialName(src.name).slot === 'mirror') fitMirrorUv(mesh);
    const mat = roomMaterial(src, palette, asset.lightRange * light, !!mesh.geometry.getAttribute('color'), light);
    mesh.material = mat;
    made.push(mat);
    // La clave de desvanecido está en el nodo de Blender (el padre si la malla tiene varios materiales).
    let n: Object3D | null = mesh;
    while (n && n.userData.fade === undefined) n = n.parent;
    const key: unknown = n?.userData.fade;
    if (parseMaterialName(src.name).slot === 'mirror') mirrors.push({ mesh, key: isWallKey(key) ? key : null });
    if (isWallKey(key)) {
      const g = groups.get(key) ?? { key, objects: [], materials: [] };
      g.objects.push(mesh);
      g.materials.push(mat);
      groups.set(key, g);
    }
  });
  return { root, groups: [...groups.values()], mirrors, dispose: () => made.forEach((m) => m.dispose()) };
}

export interface BakedRoomProps {
  asset: BakedRoomAsset;
  palette: ScenePalette;
  /** Azimut de la cámara (grados): decide qué paredes se ven. */
  azimuth: number;
  position?: readonly [number, number, number];
  /** Tamaño del plano que recibe las sombras en tiempo real (x, z). */
  floorSize: readonly [number, number];
  shadowOpacity?: number;
  /** Preparar texturas y shaders antes de mostrarla (llega con la escena ya a la vista). */
  warm?: boolean;
  /** Lo que se ve mientras se prepara (la sala procedural). */
  fallback?: ReactNode;
  /** Factor de la luz horneada (ambiente: 1 = día). */
  light?: number;
  /** Reflejo vivo de máquina y avatar en las lunas (LiveMirror): si se indica, se pinta encima. */
  mirrorLink?: MirrorLink;
}

export function BakedRoom({ asset, palette, azimuth, position = [0, 0, 0], floorSize, shadowOpacity = 0.32, warm = false, fallback, light = 1, mirrorLink }: BakedRoomProps) {
  const invalidate = useThree((s) => s.invalidate);
  const room = useMemo(() => instantiate(asset, palette, light), [asset, palette, light]);
  const ready = useWarmReveal(room.root, warm);
  useEffect(() => room.dispose, [room]);
  useLayoutEffect(() => {
    for (const g of room.groups) {
      const a = wallOpacity(g.key, azimuth);
      const fading = a < 0.999;
      for (const o of g.objects) o.visible = a > 0.01;
      for (const m of g.materials) {
        // El vidrio ya es translúcido: el desvanecido multiplica su opacidad propia.
        const base = (m.userData.baseOpacity as number | undefined) ?? 1;
        const transparent = fading || base < 1;
        if (m.transparent !== transparent) {
          m.transparent = transparent;
          m.depthWrite = !transparent;
          m.needsUpdate = true;
        }
        m.opacity = a * base;
      }
      if (mirrorLink && room.mirrors.some((r) => r.key === g.key)) {
        mirrorLink.uniforms.fade.value = a;
        mirrorLink.visible = a > 0.01;
      }
    }
    invalidate();
  }, [room, azimuth, invalidate, mirrorLink]);
  // Reflejo vivo: una capa encima de cada luna y el plano de las lunas (hacia la sala) para la cámara
  // reflejada.
  const [px, , pz] = position;
  useLayoutEffect(() => {
    if (!mirrorLink || !room.mirrors.length) return;
    const mat = mirrorOverlayMaterial(mirrorLink);
    const overlays = room.mirrors.map(({ mesh }) => {
      const o = new Mesh(mesh.geometry, mat);
      o.renderOrder = 1;
      mesh.add(o);
      return o;
    });
    const first = room.mirrors[0]!.mesh;
    first.updateWorldMatrix(true, false);
    const g = first.geometry;
    g.computeBoundingBox();
    const center = g.boundingBox!.getCenter(new Vector3()).applyMatrix4(first.matrixWorld);
    const pos = g.getAttribute('position');
    const [a, b, c] = [0, 1, 2].map((i) => new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(first.matrixWorld));
    const normal = b!.clone().sub(a!).cross(c!.clone().sub(a!)).normalize();
    // Hacia el centro de la sala.
    const roomCenter = new Vector3(px, 1, pz);
    if (normal.dot(roomCenter.clone().sub(center)) < 0) normal.negate();
    mirrorLink.plane = new Plane().setFromNormalAndCoplanarPoint(normal, center);
    invalidate();
    return () => {
      for (const o of overlays) o.removeFromParent();
      mat.dispose();
      mirrorLink.plane = null;
    };
  }, [room, mirrorLink, px, pz, invalidate]);
  return (
    <>
      {!ready && fallback}
      <group position={[position[0], position[1], position[2]]} visible={ready}>
        <primitive object={room.root} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
          <planeGeometry args={[floorSize[0], floorSize[1]]} />
          <shadowMaterial transparent opacity={shadowOpacity} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
