import { useEffect, useId, useRef, useState } from 'react';
import { HUB_ISO_ELEVATION, HUB_TILT, HUB_ZOOM } from '../scene/hubCamera';
import { useApp } from '../state/store';
import type { ViewBarSize } from './ViewBar';

/**
 * Las cuatro isométricas, por lo que se ve al fondo (cada giro levanta dos paredes de la sala:
 * scripts/environment/build_rooms.py). El número es el giro de 90° desde la vista de arranque.
 */
export const HUB_VIEWS = [
  { rotation: 0, label: 'Iso 1', title: 'Isométrica 1: espejos y ventanales' },
  { rotation: 1, label: 'Iso 2', title: 'Isométrica 2: espejos y reloj' },
  { rotation: 2, label: 'Iso 3', title: 'Isométrica 3: entrada y reloj' },
  { rotation: 3, label: 'Iso 4', title: 'Isométrica 4: entrada y ventanales' },
] as const;

/** Paso de los botones de zoom. */
export const HUB_ZOOM_STEP = 1.25;

/**
 * Barra de vista sobre el plano del gimnasio: vistas (cuatro isométricas y planta), giro,
 * inclinación, zoom, vista de arranque, capas y pantalla completa. Si el plano es estrecho, giro,
 * inclinación y zoom pasan al desplegable.
 */
export function HubViewBar({
  size,
  onZoom,
  onFullscreen,
  playing,
  onPlaying,
  rate,
  onRate,
}: {
  size: ViewBarSize;
  /** Zoom por un factor, centrado en el plano. */
  onZoom: (factor: number) => void;
  onFullscreen: (() => void) | null;
  playing: boolean;
  onPlaying: (on: boolean) => void;
  rate: number;
  onRate: (rate: number) => void;
}) {
  const narrow = size !== 'wide';
  const app = useApp();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const tilt = (deg: number) => {
    if (app.hubPlan) {
      if (deg < 0) app.set({ hubPlan: false, hubTilt: HUB_TILT[1] });
      return;
    }
    app.set({ hubTilt: Math.min(HUB_TILT[1], Math.max(HUB_TILT[0], app.hubTilt + deg)) });
  };
  // La planta, siempre con la entrada abajo: el gimnasio queda apaisado (como la pantalla) y el
  // logotipo del suelo se lee derecho.
  const chooseView = (rotation: number | 'planta') =>
    app.set({
      hubRotation: rotation === 'planta' ? 0 : rotation,
      hubPlan: rotation === 'planta',
      hubTilt: HUB_ISO_ELEVATION,
      hubZoom: 1,
      hubPan: [0, 0],
    });
  const isIso = !app.hubPlan && Math.abs(app.hubTilt - HUB_ISO_ELEVATION) < 0.01;

  // Esc cierra y el foco vuelve al botón; un clic fuera también cierra.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      btnRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const orbit = (
    <div className="hud__group" role="group" aria-label="Girar, inclinar y acercar el plano">
      <button className="hud__btn" onClick={() => app.set({ hubRotation: (app.hubRotation + 3) % 4 })} aria-label="Girar a la izquierda" title="Girar a la izquierda (Q)">
        ↺
      </button>
      <button className="hud__btn" onClick={() => app.set({ hubRotation: (app.hubRotation + 1) % 4 })} aria-label="Girar a la derecha" title="Girar a la derecha (E)">
        ↻
      </button>
      <button className="hud__btn" onClick={() => tilt(10)} aria-label="Subir la cámara 10°" title="Subir la cámara 10°" disabled={app.hubPlan || app.hubTilt >= HUB_TILT[1]}>
        ⤒
      </button>
      <button className="hud__btn" onClick={() => tilt(-10)} aria-label="Bajar la cámara 10°" title="Bajar la cámara 10°" disabled={!app.hubPlan && app.hubTilt <= HUB_TILT[0]}>
        ⤓
      </button>
      <button className="hud__btn" onClick={() => onZoom(1 / HUB_ZOOM_STEP)} aria-label="Alejar" title="Alejar (−)" disabled={app.hubZoom <= HUB_ZOOM[0] + 1e-3}>
        −
      </button>
      <button className="hud__btn" onClick={() => onZoom(HUB_ZOOM_STEP)} aria-label="Acercar" title="Acercar (+ · Ctrl o ⌘ + rueda)" disabled={app.hubZoom >= HUB_ZOOM[1] - 1e-3}>
        +
      </button>
      <button className="hud__btn" onClick={() => app.resetHubView()} aria-label="Vista de arranque" title="Vista de arranque (0)">
        ⌂
      </button>
    </div>
  );

  return (
    <div className="hud viewbar" role="toolbar" aria-label="Vista del plano">
      <div className="hud__seg" role="radiogroup" aria-label="Vista del plano">
        {HUB_VIEWS.map((v) => (
          <button
            key={v.rotation}
            role="radio"
            aria-checked={isIso && app.hubRotation === v.rotation}
            aria-label={v.title}
            title={v.title}
            className={`hud__btn${isIso && app.hubRotation === v.rotation ? ' is-on' : ''}`}
            onClick={() => chooseView(v.rotation)}
          >
            {size === 'tiny' ? v.rotation + 1 : v.label}
          </button>
        ))}
        <button role="radio" aria-checked={app.hubPlan} title="Planta (vista cenital)" className={`hud__btn${app.hubPlan ? ' is-on' : ''}`} onClick={() => chooseView('planta')}>
          Planta
        </button>
      </div>
      {!narrow && orbit}
      <div className="hud__group">
        <button
          ref={btnRef}
          className={`hud__btn hud__btn--text${open ? ' is-on' : ''}`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(!open)}
          title={narrow ? 'Cámara y capas' : 'Capas del plano'}
        >
          {narrow ? 'Más' : 'Capas'} <span aria-hidden>▾</span>
        </button>
        {onFullscreen && (
          <button className="hud__btn" onClick={onFullscreen} aria-label="Pantalla completa" title="Pantalla completa (Esc para salir)">
            ⛶
          </button>
        )}
      </div>
      {open && (
        <div ref={menuRef} id={menuId} className="hud hud__menu" role="group" aria-label={narrow ? 'Cámara y capas' : 'Capas del plano'}>
          {narrow && orbit}
          <label>
            <input type="checkbox" checked={app.hubLabels} onChange={(e) => app.set({ hubLabels: e.target.checked })} /> Rótulos de las máquinas
          </label>
          <label>
            <input type="checkbox" checked={app.hubZones} onChange={(e) => app.set({ hubZones: e.target.checked })} /> Nombres de zona
          </label>
          <label>
            <input type="checkbox" checked={playing} onChange={(e) => onPlaying(e.target.checked)} /> Movimiento
          </label>
          <label className="hud__field">
            Velocidad
            <select className="select select--small" value={rate} onChange={(e) => onRate(Number(e.target.value))}>
              <option value={0.5}>½×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
