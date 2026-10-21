import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { Bone, DetachedBindMode, Group, Matrix4, Skeleton, SkinnedMesh, Sphere, Vector3, type MeshStandardMaterial } from 'three';
import { MUSCLE_IDS, type MuscleId } from '../content/muscles';
import type { SolvedBody } from '../engine/body';
import type { MuscleActivation } from '../engine/types';
import type { ScenePalette } from '../scene/palette';
import { useWarmReveal } from '../scene/warm';
import { createBodyMaterial, createSkinMaterial, MAX_REGIONS, setLinear, type BodyUniforms, type SkinUniforms } from './materials';
import type { AnatomyModel } from './model';
import { boneMatrix, solveRig } from './rig';

const MUSCLE_SET = new Set<string>(MUSCLE_IDS);

/** Acabado de cada región que no es un músculo del catálogo. */
const FINISH: Record<string, { key: keyof ScenePalette['anatomy']; rough: number }> = {
  otros: { key: 'muscle', rough: 0.55 },
  profundo: { key: 'deep', rough: 0.75 },
  tendon: { key: 'tendon', rough: 0.4 },
  hueso: { key: 'bone', rough: 0.7 },
  guante: { key: 'glove', rough: 0.85 },
  calzado: { key: 'shoe', rough: 0.6 },
  pelo: { key: 'hair', rough: 0.9 },
  ojo: { key: 'eye', rough: 0.25 },
  iris: { key: 'iris', rough: 0.3 },
};

/** Abultamiento máximo (m) del vientre de un motor principal en plena contracción. */
const BULGE = 0.0045;

interface Instance {
  group: Group;
  bones: Bone[];
  body: SkinnedMesh;
  skin: SkinnedMesh;
  bodyU: BodyUniforms;
  skinU: SkinUniforms;
  materials: MeshStandardMaterial[];
}

function createInstance(model: AnatomyModel): Instance {
  if (model.regions.length > MAX_REGIONS) throw new Error(`El modelo trae ${model.regions.length} regiones (máximo ${MAX_REGIONS})`);
  const bones = model.manifest.bones.map(() => {
    const b = new Bone();
    b.matrixAutoUpdate = false;
    b.matrixWorldAutoUpdate = false;
    return b;
  });
  const skeleton = new Skeleton(bones, bones.map(() => new Matrix4()));
  const group = new Group();
  const b = createBodyMaterial();
  const s = createSkinMaterial();
  const mesh = (geometry: SkinnedMesh['geometry'], material: SkinnedMesh['material'], name: string) => {
    const m = new SkinnedMesh(geometry, material);
    m.name = name;
    m.bindMode = DetachedBindMode;
    m.bind(skeleton, new Matrix4());
    m.frustumCulled = false;
    // Esfera fija (solo sirve para ordenar por profundidad): sin ella three.js la calcula aplicando
    // los huesos a cada vértice la primera vez que la pinta (un tirón al cargar).
    m.boundingSphere = new Sphere(new Vector3(0, 1, 0), 3);
    // Sin picking: la selección en el gimnasio usa volúmenes invisibles propios.
    m.raycast = () => {};
    group.add(m);
    return m;
  };
  const body = mesh(model.body, b.material, 'cuerpo');
  const skin = mesh(model.skin, s.material, 'piel');
  // La piel no proyecta sombra propia: la del cuerpo ya da la silueta.
  skin.castShadow = false;
  return { group, bones, body, skin, bodyU: b.uniforms, skinU: s.uniforms, materials: [b.material, s.material] };
}

export interface AnatomyBodyProps {
  model: AnatomyModel;
  body: SolvedBody;
  palette: ScenePalette;
  muscles: readonly MuscleActivation[];
  /** 0–1: intensidad de activación según la fase. */
  activation: number;
  /** Músculos a la vista (piel translúcida) o cuerpo cubierto por la piel. */
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

/**
 * Cuerpo anatómico (músculos, capa profunda, piel envolvente, guantes, calzado y pelo) deformado
 * por el rig. Dos llamadas de dibujo por avatar: todo lo opaco en una malla y la piel en otra.
 */
export function AnatomyBody({ model, body, palette, muscles, activation, showMuscles, castShadow = true, warm = false, fallback, overlay }: AnatomyBodyProps) {
  const inst = useMemo(() => createInstance(model), [model]);
  const invalidate = useThree((s) => s.invalidate);
  const ready = useWarmReveal(inst.group, warm);

  useLayoutEffect(() => {
    inst.body.castShadow = castShadow;
    invalidate();
  }, [inst, castShadow, invalidate]);

  useLayoutEffect(() => {
    const xfs = solveRig({ landmarks: model.manifest.landmarks, bones: model.manifest.bones }, body);
    model.manifest.bones.forEach((name, i) => boneMatrix(xfs.get(name)!, inst.bones[i]!.matrixWorld));
    invalidate();
  }, [inst, model, body, invalidate]);

  useLayoutEffect(() => {
    const roles = new Map<MuscleId, MuscleActivation>(showMuscles ? muscles.map((m) => [m.muscle, m]) : []);
    const { color, glow, fx } = inst.bodyU;
    model.regions.forEach((name, i) => {
      const act = MUSCLE_SET.has(name) ? roles.get(name as MuscleId) : undefined;
      if (act) {
        const role = palette.muscle[act.role];
        const mix = 0.55 + 0.15 * act.level;
        setLinear(color[i]!, palette.anatomy.muscle).lerp(setLinear(glow[i]!, role), mix);
        setLinear(glow[i]!, role, (0.06 + 0.1 * act.level) * (0.35 + 0.65 * activation));
        // Contracción: el vientre se ensancha con el nivel del músculo y la fase.
        fx[i]!.set(BULGE * act.level * activation, 0.5);
        return;
      }
      const f = MUSCLE_SET.has(name) ? undefined : FINISH[name];
      setLinear(color[i]!, f ? palette.anatomy[f.key] : palette.anatomy.muscle);
      glow[i]!.set(0, 0, 0);
      fx[i]!.set(0, f?.rough ?? 0.52);
    });
    const skinMat = inst.materials[1]!;
    skinMat.color.set(palette.anatomy.skin);
    inst.skinU.solid.value = showMuscles ? 0 : 1;
    // Opaca: escribe profundidad (tapa bien lo de detrás aunque se pinte en la cola transparente).
    skinMat.depthWrite = !showMuscles;
    invalidate();
  }, [inst, model, palette, muscles, activation, showMuscles, invalidate]);

  useLayoutEffect(
    () => () => {
      for (const m of inst.materials) m.dispose();
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
