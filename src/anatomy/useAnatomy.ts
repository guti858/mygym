import { useEffect, useState, useSyncExternalStore } from 'react';
import { continueRender, delayRender } from 'remotion';
import { getAnatomy, loadAnatomy, subscribeAnatomy, type AnatomyModel } from './model';

/**
 * Modelo anatómico (carga diferida). Mientras llega se devuelve null y la escena usa el
 * maniquí simplificado; al renderizar vídeo con Remotion se espera a que esté cargado.
 */
export function useAnatomy(): AnatomyModel | null {
  const model = useSyncExternalStore(subscribeAnatomy, getAnatomy, getAnatomy);
  // delayRender es inocuo en el Player; al renderizar vídeo retiene el fotograma hasta la carga.
  const [handle] = useState(() => (getAnatomy() ? null : delayRender('Cargando el modelo anatómico')));
  useEffect(() => {
    loadAnatomy().then(
      // Dos fotogramas de margen para que la escena 3D se pinte con el modelo ya montado.
      () => handle !== null && requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle))),
      (err: unknown) => {
        console.error('No se pudo cargar el modelo anatómico', err);
        if (handle !== null) continueRender(handle);
      },
    );
  }, [handle]);
  return model;
}
