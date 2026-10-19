import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { OrthographicCamera } from 'three';
import type { CameraSpec } from './camera';

/** Aplica la cámara calculada (sin bucles de animación propios: todo depende del fotograma). */
export function CameraRig({ spec }: { spec: CameraSpec }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  const { position, target, zoom } = spec;
  useLayoutEffect(() => {
    camera.position.copy(position);
    camera.up.set(0, 1, 0);
    camera.zoom = zoom;
    camera.near = 0.1;
    camera.far = 100;
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, position.x, position.y, position.z, target.x, target.y, target.z, zoom, position, target]);
  return null;
}
