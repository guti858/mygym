import { useEffect, useState, useSyncExternalStore } from 'react';
import { continueRender, delayRender } from 'remotion';
import { getEnvironment, loadEnvironment, subscribeEnvironment, type GymEnvironment } from './environment';

/**
 * Salas horneadas (carga diferida). Mientras llegan se devuelve null y la escena usa la sala
 * procedural; al renderizar vídeo con Remotion se espera a que estén cargadas.
 */
export function useEnvironment(): GymEnvironment | null {
  const env = useSyncExternalStore(subscribeEnvironment, getEnvironment, getEnvironment);
  // delayRender es inocuo en el Player; al renderizar vídeo retiene el fotograma hasta la carga.
  const [handle] = useState(() => (getEnvironment() ? null : delayRender('Cargando la sala del gimnasio')));
  useEffect(() => {
    loadEnvironment().then(
      () => handle !== null && requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle))),
      (err: unknown) => {
        console.error('No se pudo cargar la sala del gimnasio', err);
        if (handle !== null) continueRender(handle);
      },
    );
  }, [handle]);
  return env;
}
