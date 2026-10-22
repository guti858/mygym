import { useEffect, useId, useRef, useState } from 'react';
import type { StationModule } from '../stations/modules';
import { AMBIENTS, AMBIENT_LABEL, type Ambient } from '../scene/palette';
import { useApp, type StationSettings } from '../state/store';

/** Rótulos cortos para los botones de vista (el nombre completo va en el título y en el nombre accesible). */
const VIEW_SHORT: Record<string, string> = { 'Desde los pies': 'Pies', 'Rodillas (desde la cabeza)': 'Rodillas' };
/** En escenas muy estrechas (móvil), también las vistas comunes se abrevian. */
const VIEW_TINY: Record<string, string> = { Isométrica: 'Iso.', Posterior: 'Post.', Superior: 'Sup.', Frontal: 'Front.', Lateral: 'Lat.' };

/** Ancho de la escena: «narrow» lleva giro y zoom al desplegable; «tiny» además abrevia las vistas. */
export type ViewBarSize = 'wide' | 'narrow' | 'tiny';

/**
 * Barra de vista sobre la escena: vistas, giro, inclinación, zoom, capas y pantalla completa.
 * Va junto a la escena (no dentro de ella) para no heredar el arrastre ni las flechas de la cámara.
 * Si la escena es estrecha, giro y zoom pasan al desplegable.
 */
export function ViewBar({ mod, st, size, onFullscreen }: { mod: StationModule; st: StationSettings; size: ViewBarSize; onFullscreen: () => void }) {
  const narrow = size !== 'wide';
  const id = mod.content.id;
  const app = useApp();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const view = mod.content.views.find((v) => v.id === st.viewId) ?? mod.content.views[0]!;
  const elevation = view.elevation + st.elevationOffset;
  const tilt = (deg: number) => app.update(id, { elevationOffset: Math.min(89, Math.max(0, elevation + deg)) - view.elevation });

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
    <div className="hud__group" role="group" aria-label="Girar, inclinar y acercar la cámara">
      <button className="hud__btn" onClick={() => app.update(id, { azimuthOffset: st.azimuthOffset - 30 })} aria-label="Girar 30° a la izquierda" title="Girar 30° a la izquierda">
        ↺
      </button>
      <button className="hud__btn" onClick={() => app.update(id, { azimuthOffset: st.azimuthOffset + 30 })} aria-label="Girar 30° a la derecha" title="Girar 30° a la derecha">
        ↻
      </button>
      <button className="hud__btn" onClick={() => tilt(15)} aria-label="Subir la cámara 15°" title="Subir la cámara 15°" disabled={elevation >= 89}>
        ⤒
      </button>
      <button className="hud__btn" onClick={() => tilt(-15)} aria-label="Bajar la cámara 15°" title="Bajar la cámara 15°" disabled={elevation <= 0}>
        ⤓
      </button>
      <button className="hud__btn" onClick={() => app.update(id, { zoom: Math.max(0.6, st.zoom / 1.15) })} aria-label="Alejar" title="Alejar" disabled={st.zoom <= 0.6}>
        −
      </button>
      <button className="hud__btn" onClick={() => app.update(id, { zoom: Math.min(2.2, st.zoom * 1.15) })} aria-label="Acercar" title="Acercar" disabled={st.zoom >= 2.2}>
        +
      </button>
    </div>
  );

  return (
    <div className="hud viewbar" role="toolbar" aria-label="Vista de la escena">
      <div className="hud__seg" role="radiogroup" aria-label="Vista de cámara">
        {mod.content.views.map((v) => (
          <button
            key={v.id}
            role="radio"
            aria-checked={st.viewId === v.id}
            aria-label={v.label}
            title={v.label}
            className={`hud__btn${st.viewId === v.id ? ' is-on' : ''}`}
            onClick={() => app.update(id, { viewId: v.id, azimuthOffset: 0, elevationOffset: 0 })}
          >
            {(size === 'tiny' ? VIEW_TINY[v.label] : undefined) ?? VIEW_SHORT[v.label] ?? v.label}
          </button>
        ))}
      </div>
      {!narrow && orbit}
      <div className="hud__group">
        <button
          ref={btnRef}
          className={`hud__btn hud__btn--text${open ? ' is-on' : ''}`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(!open)}
          title={narrow ? 'Cámara y capas' : 'Capas de la escena'}
        >
          {narrow ? 'Más' : 'Capas'} <span aria-hidden>▾</span>
        </button>
        <button className="hud__btn" onClick={onFullscreen} aria-label="Pantalla completa" title="Pantalla completa (Esc para salir)">
          ⛶
        </button>
      </div>
      {open && (
        <div ref={menuRef} id={menuId} className="hud hud__menu" role="group" aria-label={narrow ? 'Cámara y capas' : 'Capas de la escena'}>
          {narrow && orbit}
          <label>
            <input type="checkbox" checked={app.showMuscles} onChange={(e) => app.set({ showMuscles: e.target.checked })} /> Músculos activos
          </label>
          <label>
            <input type="checkbox" checked={app.showGauges} onChange={(e) => app.set({ showGauges: e.target.checked })} /> Ángulos
          </label>
          <label>
            <input type="checkbox" checked={app.showOverlay} onChange={(e) => app.set({ showOverlay: e.target.checked })} /> Rótulos de estado
          </label>
          <label title="Máquina y avatar en los espejos: más trabajo para la tarjeta gráfica">
            <input type="checkbox" checked={app.showReflection} onChange={(e) => app.set({ showReflection: e.target.checked })} /> Reflejo en los espejos
          </label>
          <AmbientField />
        </div>
      )}
    </div>
  );
}

/** Ambiente de la sala (día, tarde o noche), en el desplegable de capas del plano y de la estación. */
export function AmbientField() {
  const ambient = useApp((s) => s.ambient);
  return (
    <label className="hud__field">
      Ambiente
      <select className="select select--small" value={ambient} onChange={(e) => useApp.getState().set({ ambient: e.target.value as Ambient })}>
        {AMBIENTS.map((a) => (
          <option key={a} value={a}>
            {AMBIENT_LABEL[a]}
          </option>
        ))}
      </select>
    </label>
  );
}
