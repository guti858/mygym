import type { Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadAnatomy } from '../../anatomy/model';
import { decodeBase64, whenIdle } from '../base64';

/**
 * Salas generadas con Blender (scripts/environment/build_rooms.py): geometría con la luz horneada
 * por Cycles. El glTF llega en base64 en un fragmento aparte del bundle y se decodifica una vez.
 */

export type RoomKind = 'station' | 'hub';

export interface BakedRoomAsset {
  /** Nodos de la sala (no se modifican: cada escena clona los suyos). */
  root: Object3D;
  /** Rango codificado del atlas y de la luz por vértice: 1 = suelo de referencia. */
  lightRange: number;
}

export interface GymEnvironment {
  rooms: Record<RoomKind, BakedRoomAsset>;
}

function parse(b64: string): Promise<GymEnvironment> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      decodeBase64(b64).buffer as ArrayBuffer,
      '',
      (gltf) => {
        const rooms = {} as Record<RoomKind, BakedRoomAsset>;
        for (const scene of gltf.scenes) {
          const kind = scene.name as RoomKind;
          rooms[kind] = { root: scene, lightRange: Number(scene.userData.lightRange) || 1 };
        }
        if (!rooms.station || !rooms.hub) reject(new Error('El entorno no trae las salas «station» y «hub»'));
        else resolve({ rooms });
      },
      reject,
    );
  });
}

let cache: GymEnvironment | null = null;
let pending: Promise<GymEnvironment> | null = null;
const listeners = new Set<() => void>();

export function loadEnvironment(): Promise<GymEnvironment> {
  if (cache) return Promise.resolve(cache);
  // Después del modelo anatómico y con el navegador libre: no se apilan las dos cargas pesadas.
  pending ??= loadAnatomy()
    .catch(() => undefined)
    .then(() => whenIdle())
    .then(() => import('./gym-env.generated'))
    .then((m) => parse(m.GYM_ENV_GLB))
    .then((env) => {
      cache = env;
      for (const l of listeners) l();
      return env;
    });
  return pending;
}

export function getEnvironment(): GymEnvironment | null {
  return cache;
}

export function subscribeEnvironment(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
