import { useEffect, useLayoutEffect } from 'react';
import { startUrlSync } from '../state/url';
import { hostTheme, useApp } from '../state/store';
import { catalogEntry } from '../stations/catalog';
import { AnthroPanel } from '../ui/AnthroPanel';
import { Console } from '../ui/Console';
import { Header } from './Header';
import { HubView } from './HubView';
import { StationView } from './StationView';

export function App() {
  const route = useApp((s) => s.route);
  const theme = useApp((s) => s.theme);
  const themeLocked = useApp((s) => s.themeLocked);

  useEffect(() => startUrlSync(), []);
  // Antes del pintado: sin fotograma con el tema anterior.
  useLayoutEffect(() => {
    document.documentElement.dataset.skin = theme;
  }, [theme]);
  // Sin elección explícita, el tema sigue al sistema o al visor que aloja la página.
  useEffect(() => {
    if (themeLocked) return;
    const sync = () => useApp.setState({ theme: hostTheme() });
    sync();
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', sync);
      mo.disconnect();
    };
  }, [themeLocked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      if (e.key === ':' || e.key === '`' || e.key === 'º') {
        e.preventDefault();
        useApp.getState().set({ consoleOpen: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Antes del pintado: la vista nueva no aparece un fotograma con el desplazamiento anterior.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
    document.body.style.cursor = '';
  }, [route]);
  // Título de la pestaña del navegador según la vista.
  useEffect(() => {
    const entry = route.name === 'station' ? catalogEntry(route.id) : undefined;
    document.title = entry ? `${entry.name} · MyGym` : 'MyGym · Guion articular';
  }, [route]);

  return (
    <div className="app">
      <Header />
      <main className="main">{route.name === 'station' ? <StationView key={route.id} id={route.id} /> : <HubView />}</main>
      <footer className="footer fine">
        Contenido educativo basado en literatura y consenso técnico (fuentes en cada estación). No sustituye la valoración de un profesional. Animación con Remotion · 3D con three.js.
      </footer>
      <Console />
      <AnthroPanel />
    </div>
  );
}
