import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { BufferAttribute, Color, MeshBasicMaterial, MeshStandardMaterial, type Material, type Mesh, type Object3D } from 'three';
import { mirrorTexture } from '../GymRoom';
import type { ScenePalette } from '../palette';
import type { BakedRoomAsset } from './environment';
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

function roomMaterial(src: MeshStandardMaterial, palette: ScenePalette, range: number, vertexLit: boolean): Material {
  const { slot, mode } = parseMaterialName(src.name);
  const color = new Color(slotColor(palette, slot));
  // Espejo: luna con degradado y reflejos (un reflejo real costaría otro render de la escena).
  if (slot === 'mirror') return new MeshBasicMaterial({ map: mirrorTexture(palette) });
  // Vidrio (cielo) y tiras LED: luz propia, sin tono de cámara en el LED para que brille.
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

function instantiate(asset: BakedRoomAsset, palette: ScenePalette) {
  const root = asset.root.clone(true);
  const groups = new Map<WallKey, FadeGroup>();
  const made: Material[] = [];
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as MeshStandardMaterial;
    if (parseMaterialName(src.name).slot === 'mirror') fitMirrorUv(mesh);
    const mat = roomMaterial(src, palette, asset.lightRange, !!mesh.geometry.getAttribute('color'));
    mesh.material = mat;
    made.push(mat);
    // La clave de desvanecido está en el nodo de Blender (el padre si la malla tiene varios materiales).
    let n: Object3D | null = mesh;
    while (n && n.userData.fade === undefined) n = n.parent;
    const key: unknown = n?.userData.fade;
    if (isWallKey(key)) {
      const g = groups.get(key) ?? { key, objects: [], materials: [] };
      g.objects.push(mesh);
      g.materials.push(mat);
      groups.set(key, g);
    }
  });
  return { root, groups: [...groups.values()], dispose: () => made.forEach((m) => m.dispose()) };
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
}

export function BakedRoom({ asset, palette, azimuth, position = [0, 0, 0], floorSize, shadowOpacity = 0.32 }: BakedRoomProps) {
  const invalidate = useThree((s) => s.invalidate);
  const room = useMemo(() => instantiate(asset, palette), [asset, palette]);
  useEffect(() => room.dispose, [room]);
  useLayoutEffect(() => {
    for (const g of room.groups) {
      const a = wallOpacity(g.key, azimuth);
      const fading = a < 0.999;
      for (const o of g.objects) o.visible = a > 0.01;
      for (const m of g.materials) {
        if (m.transparent !== fading) {
          m.transparent = fading;
          m.depthWrite = !fading;
          m.needsUpdate = true;
        }
        m.opacity = a;
      }
    }
    invalidate();
  }, [room, azimuth, invalidate]);
  return (
    <group position={[position[0], position[1], position[2]]}>
      <primitive object={room.root} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[floorSize[0], floorSize[1]]} />
        <shadowMaterial transparent opacity={shadowOpacity} depthWrite={false} />
      </mesh>
    </group>
  );
}
