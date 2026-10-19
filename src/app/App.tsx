import { useEffect } from 'react';
import { startUrlSync } from '../state/url';
import { useApp } from '../state/store';
import { AnthroPanel } from '../ui/AnthroPanel';
import { Console } from '../ui/Console';
import { Header } from './Header';
import { HubView } from './HubView';
import { StationView } from './StationView';

export function App() {
  const route = useApp((s) => s.route);
  const theme = useApp((s) => s.theme);

  useEffect(() => startUrlSync(), []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
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
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.body.style.cursor = '';
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
