import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { continueRender, delayRender } from 'remotion';
import type { Sex } from '../engine/anthropometry';
import { getAnatomy, loadAnatomy, subscribeAnatomy, type AnatomyModel } from './model';

/**
 * Modelo anatómico de un sexo (carga diferida). Mientras llega se devuelve null y la escena usa el
 * maniquí simplificado; al renderizar vídeo con Remotion se espera a que esté cargado.
 */
export function useAnatomy(sex: Sex): AnatomyModel | null {
  const get = useCallback(() => getAnatomy(sex), [sex]);
  const model = useSyncExternalStore(subscribeAnatomy, get, get);
  // delayRender es inocuo en el Player; al renderizar vídeo retiene el fotograma hasta la carga.
  const [handle] = useState(() => (getAnatomy(sex) ? null : delayRender('Cargando el modelo anatómico')));
  useEffect(() => {
    loadAnatomy(sex).then(
      // Dos fotogramas de margen para que la escena 3D se pinte con el modelo ya montado.
      () => handle !== null && requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle))),
      (err: unknown) => {
        console.error('No se pudo cargar el modelo anatómico', err);
        if (handle !== null) continueRender(handle);
      },
    );
  }, [handle, sex]);
  return model;
}
