import { useThree, type RootState } from '@react-three/fiber';
import { useEffect } from 'react';
import { useRemotionEnvironment } from 'remotion';

/**
 * Repinta el lienzo cuando llega un recurso cargado en diferido (sala horneada, modelo anatómico).
 * Al renderizar vídeo, `@remotion/three` solo pinta el lienzo al cambiar de fotograma: si el recurso
 * llega después, la captura saldría con lo de antes aunque `delayRender` la haya esperado.
 * Va al final del lienzo, para que sus hermanos (materiales, paredes, rayos X) ya estén al día.
 */
export function Repaint({ ready }: { ready: readonly unknown[] }) {
  const advance = useThree((s) => s.advance);
  const invalidate = useThree((s) => s.invalidate);
  const { isRendering } = useRemotionEnvironment();
  const key = ready.map((r) => (r ? 1 : 0)).join('');
  useEffect(() => {
    if (isRendering) advance(performance.now());
    else invalidate();
  }, [key, isRendering, advance, invalidate]);
  return null;
}

/**
 * Ajustes del renderizador al crear cada lienzo. Sin la comprobación de errores de shaders, three.js
 * no pregunta al driver por el enlazado de cada programa nada más usarlo, una espera síncrona que
 * daba tirones al aparecer materiales nuevos (los shaders son los de three.js, ya probados).
 */
export function tuneRenderer({ gl }: RootState) {
  gl.debug.checkShaderErrors = false;
}
