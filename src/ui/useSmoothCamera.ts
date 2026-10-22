import { useEffect, useRef, useState } from 'react';
import type { HubView } from '../scene/hubCamera';

export interface CameraAngles {
  azimuth: number;
  elevation: number;
}

/** Diferencia angular más corta (grados, en (−180, 180]). */
export const angleDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/** Constante de tiempo del seguimiento de cámara: al cambiar de vista se asienta en ~0,5 s. */
const CAMERA_TAU = 0.11;

/**
 * Cámara interpolada: sigue al objetivo (vista + giros) con un amortiguado exponencial, por el
 * camino angular más corto. Al cambiar de vista la cámara orbita hasta la nueva en lugar de saltar,
 * y el arrastre se siente continuo. Con «reducir movimiento» va directa.
 */
export function useSmoothCamera(target: CameraAngles, instant: boolean, jumpKey = 0): CameraAngles {
  const [cur, setCur] = useState(target);
  const ref = useRef(target);
  // Un `jumpKey` nuevo (distinto de 0) pide colocar la cámara directamente en el objetivo.
  const lastJump = useRef(jumpKey);
  const { azimuth, elevation } = target;
  useEffect(() => {
    const jump = jumpKey !== 0 && jumpKey !== lastJump.current;
    lastJump.current = jumpKey;
    if (instant || jump) {
      ref.current = { azimuth, elevation };
      setCur(ref.current);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const c = ref.current;
      const daz = angleDelta(c.azimuth, azimuth);
      const del = elevation - c.elevation;
      const done = Math.abs(daz) < 0.05 && Math.abs(del) < 0.05;
      const k = done ? 1 : 1 - Math.exp(-dt / CAMERA_TAU);
      ref.current = { azimuth: c.azimuth + daz * k, elevation: c.elevation + del * k };
      setCur(ref.current);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [azimuth, elevation, instant, jumpKey]);
  return cur;
}

/**
 * Paso máximo de tiempo por fotograma en el plano. Más amplio que en la estación: en un equipo lento
 * (pocos fotogramas por segundo) la cámara sigue llegando a tiempo, y el acercamiento a una máquina
 * no se queda a medias cuando empieza el fundido con la estación.
 */
const HUB_MAX_DT = 0.25;

/**
 * Lo mismo para el plano del gimnasio, que además se acerca y se desplaza: giro por el camino más
 * corto, zoom en escala logarítmica (acercarse de 1× a 2× dura lo mismo que de 2× a 4×) y
 * desplazamiento lineal.
 */
export function useSmoothHubView(target: HubView, instant: boolean): HubView {
  const [cur, setCur] = useState(target);
  const ref = useRef(target);
  const { azimuth, elevation, zoom, panX, panZ } = target;
  useEffect(() => {
    if (instant) {
      ref.current = { azimuth, elevation, zoom, panX, panZ };
      setCur(ref.current);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(HUB_MAX_DT, (now - last) / 1000);
      last = now;
      const c = ref.current;
      const d = {
        azimuth: angleDelta(c.azimuth, azimuth),
        elevation: elevation - c.elevation,
        zoom: Math.log(zoom / c.zoom),
        panX: panX - c.panX,
        panZ: panZ - c.panZ,
      };
      const done = Math.abs(d.azimuth) < 0.05 && Math.abs(d.elevation) < 0.05 && Math.abs(d.zoom) < 0.002 && Math.abs(d.panX) < 0.005 && Math.abs(d.panZ) < 0.005;
      const k = done ? 1 : 1 - Math.exp(-dt / CAMERA_TAU);
      ref.current = {
        azimuth: c.azimuth + d.azimuth * k,
        elevation: c.elevation + d.elevation * k,
        zoom: c.zoom * Math.exp(d.zoom * k),
        panX: c.panX + d.panX * k,
        panZ: c.panZ + d.panZ * k,
      };
      setCur(ref.current);
      if (!done) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [azimuth, elevation, zoom, panX, panZ, instant]);
  return cur;
}
