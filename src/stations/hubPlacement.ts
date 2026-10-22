import { Vector3 } from 'three';
import type { CatalogEntry } from './catalog';
import { getModule } from './modules';

/**
 * Cada máquina en el plano del gimnasio: se centra en su sitio (`entry.hub`) y se gira `yaw`
 * (igual que en HubComposition). De aquí salen su zona de clic, su encuadre al abrirla y el punto
 * donde se ancla su tarjeta.
 */
export interface HubFootprint {
  /** Centro de la caja de la máquina en sus propios ejes (se desplaza para que quede en su sitio). */
  center: readonly [number, number];
  /** Mitades de la huella en sus propios ejes (x, z) y altura. */
  half: readonly [number, number];
  height: number;
}

export function hubFootprint(entry: CatalogEntry): HubFootprint {
  const b = getModule(entry.id)?.logic.bounds;
  if (!b) return { center: [0, 0], half: [1.1, 1.1], height: 2.2 };
  return {
    center: [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2],
    half: [(b.max[0] - b.min[0]) / 2, (b.max[2] - b.min[2]) / 2],
    height: b.max[1],
  };
}

const UP = new Vector3(0, 1, 0);

/** Las 8 esquinas de la caja de la máquina en el mundo del gimnasio. */
export function hubCorners(entry: CatalogEntry): Vector3[] {
  const { half, height } = hubFootprint(entry);
  const out: Vector3[] = [];
  for (const x of [-half[0], half[0]]) {
    for (const y of [0, height]) {
      for (const z of [-half[1], half[1]]) out.push(new Vector3(x, y, z).applyAxisAngle(UP, entry.hub.yaw).add(new Vector3(entry.hub.x, 0, entry.hub.z)));
    }
  }
  return out;
}

/** Punto del mundo sobre el centro de la máquina, a la altura `y`. */
export const hubPoint = (entry: CatalogEntry, y: number) => new Vector3(entry.hub.x, y, entry.hub.z);

/** Altura del rótulo: justo encima de la máquina (a altura fija, el de una baja flotaría sobre la de detrás). */
export const hubLabelY = (entry: CatalogEntry) => Math.min(2.55, hubFootprint(entry).height + 0.35);
