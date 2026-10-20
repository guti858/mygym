import { useEffect, useRef, useState } from 'react';

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
export function useSmoothCamera(target: CameraAngles, instant: boolean): CameraAngles {
  const [cur, setCur] = useState(target);
  const ref = useRef(target);
  const { azimuth, elevation } = target;
  useEffect(() => {
    if (instant) {
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
  }, [azimuth, elevation, instant]);
  return cur;
}
