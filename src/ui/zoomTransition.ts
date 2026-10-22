/**
 * Transición del gimnasio a una estación sin tirones.
 *
 * El plano ya se ha acercado a la máquina con su propia cámara (nítido, a la resolución del lienzo).
 * Se copia en un lienzo superpuesto, se monta la estación debajo y la copia se funde: el fundido lo
 * ejecuta el compositor del navegador (Web Animations), así que sigue fluido aunque el hilo principal
 * esté ocupado montando la estación (React, WebGL, shaders).
 *
 * Respaldo (`zoom` > 1): si el plano no ha podido acercarse, la copia se amplía hacia la máquina
 * mientras se funde, como antes (pixela un poco, pero no corta en seco).
 */

const ZOOM_MS = 620;
const FADE_MS = 220;

/**
 * Siguiente fotograma o, si tarda (la página está cargando y cada fotograma cuesta segundos), al cabo
 * de `ms`: la navegación nunca queda a expensas de la animación.
 */
export const nextFrame = (ms = 150) =>
  new Promise<void>((r) => {
    const t = window.setTimeout(r, ms);
    requestAnimationFrame(() => {
      window.clearTimeout(t);
      r();
    });
  });

/**
 * Funde la imagen actual de `source` sobre lo que monte `swap`. Con `zoom`, además la amplía hacia
 * `focus` (coordenadas de la ventana). Devuelve una promesa que se resuelve al terminar.
 */
export async function crossfadeFrom(source: HTMLCanvasElement, swap: () => void, zoom?: { focus: { x: number; y: number }; scale: number }): Promise<void> {
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
  let move: Animation | null = null;
  if (zoom) {
    // Con origen en la esquina, un punto p acaba en p·S + t: la máquina va al centro del plano.
    const tx = rect.width / 2 - (zoom.focus.x - rect.left) * zoom.scale;
    const ty = rect.height / 2 - (zoom.focus.y - rect.top) * zoom.scale;
    move = snap.animate([{ transform: 'translate(0px, 0px) scale(1)' }, { transform: `translate(${tx}px, ${ty}px) scale(${zoom.scale})` }], {
      duration: ZOOM_MS,
      easing: 'cubic-bezier(0.45, 0, 0.2, 1)',
      fill: 'forwards',
    });
  }
  // Un fotograma para que el compositor tome la copia antes de bloquear el hilo principal.
  await nextFrame();
  swap();
  // La estación ha pintado cuando vuelven a correr los fotogramas tras montarla.
  await nextFrame();
  await nextFrame();
  await move?.finished.catch(() => undefined);
  const fade = snap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease-out', fill: 'forwards' });
  await fade.finished.catch(() => undefined);
  snap.remove();
}
