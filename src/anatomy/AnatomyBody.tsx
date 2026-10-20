import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Bone, Color, DetachedBindMode, Group, Matrix4, MeshPhysicalMaterial, MeshStandardMaterial, Skeleton, SkinnedMesh, Sphere, Vector3 } from 'three';
import { MUSCLE_IDS, type MuscleId } from '../content/muscles';
import type { SolvedBody } from '../engine/body';
import type { MuscleActivation } from '../engine/types';
import type { ScenePalette } from '../scene/palette';
import type { AnatomyModel } from './model';
import { boneMatrix, solveRig } from './rig';
import { useWarmReveal } from '../scene/warm';

const MUSCLE_SET = new Set<string>(MUSCLE_IDS);

/** Acabado de cada grupo de render que no es un músculo del catálogo. */
const FINISH: Record<string, { key: keyof ScenePalette['anatomy']; rough: number }> = {
  otros: { key: 'muscle', rough: 0.55 },
  tendon: { key: 'tendon', rough: 0.4 },
  hueso: { key: 'bone', rough: 0.7 },
  piel: { key: 'skin', rough: 0.72 },
  guante: { key: 'glove', rough: 0.85 },
  calzado: { key: 'shoe', rough: 0.6 },
  pelo: { key: 'hair', rough: 0.95 },
  ojo: { key: 'eye', rough: 0.25 },
  iris: { key: 'iris', rough: 0.3 },
};

interface Instance {
  group: Group;
  bones: Bone[];
  materials: Map<string, MeshStandardMaterial>;
}

function createInstance(model: AnatomyModel): Instance {
  const bones = model.manifest.bones.map(() => {
    const b = new Bone();
    b.matrixAutoUpdate = false;
    b.matrixWorldAutoUpdate = false;
    return b;
  });
  const skeleton = new Skeleton(bones, bones.map(() => new Matrix4()));
  const group = new Group();
  const materials = new Map<string, MeshStandardMaterial>();
  for (const [name, geometry] of model.geometries) {
    // Músculo con un brillo húmedo suave (sheen + clearcoat); el resto, material estándar.
    const isMuscle = MUSCLE_SET.has(name) || name === 'otros';
    const material = isMuscle
      ? new MeshPhysicalMaterial({ metalness: 0, roughness: 0.5, sheen: 0.6, sheenRoughness: 0.45, clearcoat: 0.18, clearcoatRoughness: 0.5 })
      : new MeshStandardMaterial({ metalness: 0, roughness: FINISH[name]?.rough ?? 0.52 });
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = name;
    mesh.bindMode = DetachedBindMode;
    mesh.bind(skeleton, new Matrix4());
    mesh.frustumCulled = false;
    // Esfera fija (solo sirve para ordenar por profundidad): sin ella three.js la calcula aplicando
    // los huesos a cada vértice de cada malla la primera vez que la pinta (un tirón al cargar).
    mesh.boundingSphere = new Sphere(new Vector3(0, 1, 0), 3);
    // Sin picking: la selección en el gimnasio usa volúmenes invisibles propios.
    mesh.raycast = () => {};
    group.add(mesh);
    materials.set(name, material);
  }
  return { group, bones, materials };
}

export interface AnatomyBodyProps {
  model: AnatomyModel;
  body: SolvedBody;
  palette: ScenePalette;
  muscles: readonly MuscleActivation[];
  /** 0–1: intensidad de activación según la fase. */
  activation: number;
  showMuscles: boolean;
  /** Sombra propia (se desactiva en el gimnasio, donde hay varios avatares pequeños). */
  castShadow?: boolean;
  /** Preparar texturas y shaders antes de mostrarlo (llega con la escena ya a la vista). */
  warm?: boolean;
  /** Lo que se ve mientras se prepara (el maniquí). */
  fallback?: ReactNode;
  /** Lo que acompaña al cuerpo una vez a la vista (marcadores articulares). */
  overlay?: ReactNode;
}

const tmp = new Color();

/** Cuerpo anatómico (músculos, huesos visibles y piel de cabeza, manos y pies) deformado por el rig. */
export function AnatomyBody({ model, body, palette, muscles, activation, showMuscles, castShadow = true, warm = false, fallback, overlay }: AnatomyBodyProps) {
  const inst = useMemo(() => createInstance(model), [model]);
  const invalidate = useThree((s) => s.invalidate);
  const ready = useWarmReveal(inst.group, warm);

  useLayoutEffect(() => {
    for (const mesh of inst.group.children) mesh.castShadow = castShadow && mesh.name !== 'ojo' && mesh.name !== 'iris';
    invalidate();
  }, [inst, castShadow, invalidate]);

  useLayoutEffect(() => {
    const xfs = solveRig({ landmarks: model.manifest.landmarks, bones: model.manifest.bones }, body);
    model.manifest.bones.forEach((name, i) => boneMatrix(xfs.get(name)!, inst.bones[i]!.matrixWorld));
    invalidate();
  }, [inst, model, body, invalidate]);

  useLayoutEffect(() => {
    const roles = new Map<MuscleId, MuscleActivation>(showMuscles ? muscles.map((m) => [m.muscle, m]) : []);
    const neutral = palette.anatomy.muscle;
    for (const [name, mat] of inst.materials) {
      if (MUSCLE_SET.has(name)) {
        const act = roles.get(name as MuscleId);
        if (act) {
          const role = palette.muscle[act.role];
          const mix = 0.55 + 0.15 * act.level;
          mat.color.set(neutral).lerp(tmp.set(role), mix);
          if (mat instanceof MeshPhysicalMaterial) mat.sheenColor.set(role).lerp(tmp.set('#ffffff'), 0.4);
          mat.emissive.set(role);
          mat.emissiveIntensity = (0.06 + 0.1 * act.level) * (0.35 + 0.65 * activation);
        } else {
          mat.color.set(neutral);
          if (mat instanceof MeshPhysicalMaterial) mat.sheenColor.set(neutral).lerp(tmp.set('#ffffff'), 0.35);
          mat.emissive.set('#000000');
          mat.emissiveIntensity = 0;
        }
      } else {
        const f = FINISH[name];
        mat.color.set(f ? palette.anatomy[f.key] : neutral);
        if (mat instanceof MeshPhysicalMaterial) mat.sheenColor.set(mat.color).lerp(tmp.set('#ffffff'), 0.35);
      }
    }
    invalidate();
  }, [inst, palette, muscles, activation, showMuscles, invalidate]);

  useLayoutEffect(
    () => () => {
      for (const m of inst.materials.values()) m.dispose();
    },
    [inst],
  );

  return (
    <>
      {!ready && fallback}
      <primitive object={inst.group} visible={ready} />
      {ready && overlay}
    </>
  );
}
