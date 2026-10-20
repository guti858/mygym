import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { Raycaster, type Group, type Material, type Mesh, type Vector3 } from 'three';

/** Opacidad de una pieza que tapa al avatar. */
const GHOST = 0.22;
const raycaster = new Raycaster();

interface Saved {
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

function setGhost(mat: Material, ghost: boolean): boolean {
  const saved = mat.userData.xray as Saved | undefined;
  if (ghost === !!saved) return false;
  if (ghost) {
    mat.userData.xray = { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite } satisfies Saved;
    mat.opacity = Math.min(mat.opacity, GHOST);
    mat.transparent = true;
    mat.depthWrite = false;
  } else {
    Object.assign(mat, saved);
    delete mat.userData.xray;
  }
  mat.needsUpdate = true;
  return true;
}

/**
 * Rayos X de la máquina: las piezas que se interponen entre la cámara y alguna articulación del
 * cuerpo se vuelven translúcidas. Así cualquier giro de cámara sirve (la pila de placas o la torre
 * de poleas ya no esconden al avatar) sin tener que vetar ángulos máquina a máquina.
 * Es determinista: depende solo de la postura y la cámara de este fotograma.
 */
export function XRay({ target, points, toCamera }: { target: React.RefObject<Group | null>; points: readonly Vector3[]; toCamera: Vector3 }) {
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    const root = target.current;
    if (!root) return;
    root.updateMatrixWorld(true);
    // Lo que la mano agarra o el cuerpo toca (a menos de 7 cm) no cuenta como obstáculo.
    raycaster.near = 0.07;
    raycaster.far = 10;
    const hit = new Set<Mesh>();
    for (const p of points) {
      raycaster.set(p, toCamera);
      for (const h of raycaster.intersectObject(root, true)) hit.add(h.object as Mesh);
    }
    let changed = false;
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) changed = setGhost(mat, hit.has(mesh)) || changed;
    });
    if (changed) invalidate();
  });
  return null;
}
