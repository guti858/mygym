import { parseTempo, tempoToString } from '../engine/timeline';
import { getModule } from '../stations/modules';
import { defaultSettings, settingsFor, useApp, type Route } from './store';

/** #/ → gimnasio · #/e/<estacion>?v=..&kg=..&err=..&vista=..&tempo=..&reps=.. */
export function parseHash(hash: string): { route: Route; params: URLSearchParams } {
  const clean = hash.replace(/^#/, '');
  const [path = '', query = ''] = clean.split('?');
  const params = new URLSearchParams(query);
  const m = path.match(/^\/e\/([a-z0-9_]+)/);
  if (m && getModule(m[1]!)) return { route: { name: 'station', id: m[1]! }, params };
  return { route: { name: 'hub' }, params };
}

export function hashFor(): string {
  const s = useApp.getState();
  if (s.route.name !== 'station') return '#/';
  const st = settingsFor(s, s.route.id);
  const q = new URLSearchParams();
  q.set('v', st.variantId);
  q.set('kg', String(st.loadKg));
  if (st.errorId) q.set('err', st.errorId);
  q.set('vista', st.viewId);
  // Giro e inclinación respecto a la vista: el enlace reproduce el mismo ángulo de cámara.
  if (st.azimuthOffset) q.set('giro', String(Math.round(st.azimuthOffset)));
  if (st.elevationOffset) q.set('incl', String(Math.round(st.elevationOffset)));
  q.set('tempo', tempoToString(st.tempo));
  q.set('reps', String(st.reps));
  return `#/e/${s.route.id}?${q.toString()}`;
}

export function applyHash(hash: string) {
  const { route, params } = parseHash(hash);
  const app = useApp.getState();
  app.go(route);
  if (route.name !== 'station') return;
  const id = route.id;
  if (!app.settings[id]) app.update(id, defaultSettings(id));
  const v = params.get('v');
  if (v) app.setVariant(id, v);
  const kg = Number(params.get('kg'));
  if (params.has('kg') && Number.isFinite(kg)) app.update(id, { loadKg: kg });
  const err = params.get('err');
  app.update(id, { errorId: err || null });
  const vista = params.get('vista');
  if (vista) app.update(id, { viewId: vista });
  const giro = Number(params.get('giro') ?? 0);
  const incl = Number(params.get('incl') ?? 0);
  app.update(id, { azimuthOffset: Number.isFinite(giro) ? giro : 0, elevationOffset: Number.isFinite(incl) ? incl : 0 });
  const tempo = params.get('tempo');
  const t = tempo ? parseTempo(tempo) : null;
  if (t) app.update(id, { tempo: t });
  const reps = Number(params.get('reps'));
  if (params.has('reps') && reps >= 1 && reps <= 10) app.update(id, { reps: Math.round(reps) });
}

/** Sincroniza estado ↔ URL. Devuelve la función de limpieza. */
export function startUrlSync(): () => void {
  applyHash(window.location.hash);
  let last = hashFor();
  const unsub = useApp.subscribe((s, prev) => {
    const next = hashFor();
    if (next === last) return;
    const routeChanged = s.route !== prev.route;
    last = next;
    // En marcos aislados (p. ej. al publicarse dentro de otra web) el historial puede no estar disponible:
    // la navegación sigue funcionando en memoria.
    try {
      if (routeChanged) window.history.pushState(null, '', next);
      else window.history.replaceState(null, '', next);
    } catch {
      /* sin URL compartible */
    }
  });
  const onHash = () => {
    applyHash(window.location.hash);
    last = hashFor();
  };
  window.addEventListener('popstate', onHash);
  window.addEventListener('hashchange', onHash);
  return () => {
    unsub();
    window.removeEventListener('popstate', onHash);
    window.removeEventListener('hashchange', onHash);
  };
}
