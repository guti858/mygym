import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { useRemotionEnvironment } from 'remotion';
import type { Material, Mesh, Object3D, Texture } from 'three';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function texturesOf(root: Object3D): Set<Texture> {
  const out = new Set<Texture>();
  root.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    for (const mat of m ? [m].flat() : []) {
      for (const v of Object.values(mat)) if ((v as Texture | null)?.isTexture) out.add(v as Texture);
    }
  });
  return out;
}

/**
 * Revelado «en caliente» de algo que llega cuando la escena ya se está viendo (la sala horneada o el
 * modelo anatómico, que se cargan en diferido). Antes de mostrarlo sube sus texturas a la GPU (una
 * por fotograma) y compila sus shaders en segundo plano (`compileAsync`, con la compilación
 * paralela del driver). Mientras tanto el llamador sigue mostrando lo de antes; así su aparición no
 * congela la animación.
 *
 * Con `warm` a false (el recurso ya estaba al montar: lo tapa la transición de entrada) o al
 * renderizar vídeo, se muestra en el acto.
 */
export function useWarmReveal(object: Object3D | null, warm: boolean): boolean {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const { isRendering } = useRemotionEnvironment();
  const [ready, setReady] = useState<Object3D | null>(null);
  const immediate = !warm || isRendering;
  useEffect(() => {
    if (!object || immediate) return;
    let cancelled = false;
    void (async () => {
      for (const t of texturesOf(object)) {
        if (cancelled) return;
        gl.initTexture(t);
        await nextFrame();
      }
      // Sin la extensión de compilación paralela, compileAsync acaba esperando igual: tope de 4 s.
      await Promise.race([gl.compileAsync(object, camera, scene), wait(4000)]);
      if (cancelled) return;
      setReady(object);
      invalidate();
    })();
    return () => {
      cancelled = true;
    };
  }, [object, immediate, gl, camera, scene, invalidate]);
  return immediate || (object !== null && ready === object);
}
