/**
 * Transición del gimnasio a una estación sin tirones.
 *
 * Se copia el plano del gimnasio en un lienzo superpuesto y ese lienzo se acerca a la máquina con
 * una animación de `transform` (Web Animations): la ejecuta el compositor del navegador, así que
 * sigue fluida aunque el hilo principal esté ocupado montando la estación debajo (React, WebGL,
 * shaders). Cuando la estación ya ha pintado, la copia se funde y desaparece.
 */

/** Ampliación final de la copia (la máquina pasa al centro). */
const SCALE = 2.4;
const ZOOM_MS = 620;
const FADE_MS = 300;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Acerca la copia de `source` hacia `focus` (coordenadas de la ventana) y llama a `swap` en cuanto
 * la animación está en marcha en el compositor. Devuelve una promesa que se resuelve al terminar.
 */
export async function zoomInto(source: HTMLCanvasElement, focus: { x: number; y: number }, swap: () => void): Promise<void> {
  const rect = source.getBoundingClientRect();
  const snap = document.createElement('canvas');
  snap.width = source.width;
  snap.height = source.height;
  try {
    snap.getContext('2d')?.drawImage(source, 0, 0);
  } catch {
    swap();
    return;
  }
  snap.setAttribute('aria-hidden', 'true');
  snap.className = 'zoom-snap';
  Object.assign(snap.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  document.body.appendChild(snap);
  // Con origen en la esquina, un punto p acaba en p·S + t: la máquina va al centro del plano.
  const fx = focus.x - rect.left;
  const fy = focus.y - rect.top;
  const tx = rect.width / 2 - fx * SCALE;
  const ty = rect.height / 2 - fy * SCALE;
  const zoom = snap.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: `translate(${tx}px, ${ty}px) scale(${SCALE})` }], {
    duration: ZOOM_MS,
    easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
    fill: 'forwards',
  });
  // Un fotograma para que el compositor tome la animación antes de bloquear el hilo principal.
  await frame();
  swap();
  // La estación ha pintado cuando vuelven a correr los fotogramas tras montarla.
  await frame();
  await frame();
  await zoom.finished.catch(() => undefined);
  const fade = snap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
  await fade.finished.catch(() => undefined);
  snap.remove();
}
