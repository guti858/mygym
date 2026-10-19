/**
 * Calibración: imprime métricas simuladas y alertas de una estación por perfil y progreso.
 * Uso: npx tsx scripts/explore-station.ts <id> [variante] [error]
 */
import { ANTHRO_TEST_PROFILES, computeSegments } from '../src/engine/anthropometry';
import { evaluateFrame } from '../src/engine/evaluate';
import { STATION_MODULES } from '../src/stations/modules';

const [, , id = 'press_militar', variantArg, errorArg] = process.argv;
const mod = STATION_MODULES[id];
if (!mod) throw new Error(`Estación desconocida: ${id}`);
const variants = variantArg && variantArg !== '-' ? [variantArg] : mod.content.variants.map((v) => v.id);
for (const variantId of variants) {
  const v = mod.content.variants.find((x) => x.id === variantId);
  if (!v) throw new Error(`Variante desconocida: ${variantId} (hay: ${mod.content.variants.map((x) => x.id).join(', ')})`);
  const metrics = [...new Set(v.windows.map((w) => w.metric))];
  console.log(`\n=== ${id} / ${variantId}${errorArg ? ` / error ${errorArg}` : ''} ===`);
  console.log(['perfil', 'p', ...metrics.map((m) => m.replace('shoulder.', 'sh.')), 'alertas'].join('\t'));
  for (const [name, anthro] of Object.entries(ANTHRO_TEST_PROFILES)) {
    const seg = computeSegments(anthro);
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const r = evaluateFrame(mod.logic, mod.content, { anthro, seg, variantId, errorId: errorArg ?? null, loadKg: mod.logic.defaultLoadKg, p, phase: p === 0 ? 'pausa_estiramiento' : p === 1 ? 'pausa_contraccion' : 'concentrica' });
      const vals = metrics.map((m) => {
        const l = r.metrics[`${m}.L`];
        return (l ?? r.metrics[m] ?? 0).toFixed(0);
      });
      const bad = r.evaluations.filter((e) => e.status !== 'ok').map((e) => `${e.window.id}${e.side ?? ''}=${e.value.toFixed(0)}`);
      const sf = Math.max(...Object.values(r.body.arms).map((a) => a.shortfall), ...Object.values(r.body.legs).map((l) => l.shortfall));
      console.log([name, p, ...vals, (sf > 0.005 ? `SHORT ${sf.toFixed(3)} ` : '') + bad.join(' ')].join('\t'));
    }
  }
}
