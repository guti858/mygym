import { MUSCLES, ROLE_LABEL } from '../content/muscles';
import { findVariant } from '../engine/evaluate';
import { loadValueLabel } from '../engine/load';
import { JOINT_MOMENT_LABEL } from '../engine/moments';
import { compositionId } from '../remotion/props';
import { PHASE_LABEL, parseTempo, tempoToString } from '../engine/timeline';
import type { ThemeId } from '../scene/palette';
import { CATALOG } from '../stations/catalog';
import { getModule } from '../stations/modules';
import { bridge } from './bridge';
import { settingsFor, useApp, useFrame } from './store';

export interface Command {
  name: string;
  aliases?: string[];
  usage: string;
  help: string;
  /** Sugerencias para el argumento n-ésimo. */
  complete?: (args: string[]) => string[];
  run: (args: string[]) => string | string[] | void;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

class CmdError extends Error {}
const fail = (msg: string): never => {
  throw new CmdError(msg);
};

function activeStation() {
  const s = useApp.getState();
  if (s.route.name !== 'station') fail('Primero entra en una estación: «ir jalon».');
  const id = (s.route as { id: string }).id;
  return { id, mod: getModule(id)!, st: settingsFor(s, id) };
}

const STATION_IDS = () => CATALOG.map((c) => c.id);
const BOOL = (v: string | undefined) => {
  const n = norm(v ?? '');
  if (['si', 'on', '1', 'true', 'mostrar'].includes(n)) return true;
  if (['no', 'off', '0', 'false', 'ocultar'].includes(n)) return false;
  return fail('Usa «si» o «no».');
};

export const COMMANDS: Command[] = [
  {
    name: 'ayuda',
    aliases: ['help', '?'],
    usage: 'ayuda [comando]',
    help: 'Lista de comandos o ayuda de uno concreto.',
    complete: () => COMMANDS.map((c) => c.name),
    run: ([name]) => {
      if (name) {
        const c = findCommand(name) ?? fail(`No existe el comando «${name}».`);
        return [`${c.usage}`, `  ${c.help}`];
      }
      return ['Comandos disponibles:', ...COMMANDS.map((c) => `  ${c.usage.padEnd(30)} ${c.help}`), 'Tab autocompleta · ↑/↓ historial · Esc cierra.'];
    },
  },
  {
    name: 'ir',
    aliases: ['go', 'abrir'],
    usage: 'ir <estación|gimnasio>',
    help: 'Navega a una estación o vuelve al gimnasio.',
    complete: () => ['gimnasio', ...STATION_IDS()],
    run: ([dest]) => {
      if (!dest) return fail('Indica destino: «ir jalon» o «ir gimnasio».');
      const d = norm(dest);
      if (d === 'gimnasio' || d === 'hub' || d === 'inicio') {
        useApp.getState().go({ name: 'hub' });
        return 'Gimnasio.';
      }
      const entry = CATALOG.find((c) => c.id === d || norm(c.name).includes(d)) ?? fail(`No hay ninguna estación «${dest}».`);
      if (!entry.ready) return fail(`«${entry.name}» llegará en un próximo lote de F4 (aún no disponible).`);
      useApp.getState().go({ name: 'station', id: entry.id });
      return `→ ${entry.name}`;
    },
  },
  {
    name: 'estaciones',
    aliases: ['ls'],
    usage: 'estaciones',
    help: 'Lista las 12 estaciones y su estado.',
    run: () => CATALOG.map((c) => `  ${c.ready ? '●' : '○'} ${c.id.padEnd(16)} ${c.name}${c.ready ? '' : '  (próximamente)'}`),
  },
  {
    name: 'variante',
    aliases: ['agarre', 'modalidad'],
    usage: 'variante <id>',
    help: 'Cambia el agarre o la modalidad.',
    complete: () => {
      const s = useApp.getState();
      if (s.route.name !== 'station') return [];
      return getModule(s.route.id)!.content.variants.map((v) => v.id);
    },
    run: ([id]) => {
      const { id: sid, mod } = activeStation();
      if (!id) return ['Variantes:', ...mod.content.variants.map((v) => `  ${v.id.padEnd(18)} ${v.name}`)];
      const v = mod.content.variants.find((x) => x.id === norm(id) || norm(x.short) === norm(id)) ?? fail(`Variante «${id}» no existe.`);
      useApp.getState().setVariant(sid, v.id);
      return `Variante: ${v.name}`;
    },
  },
  {
    name: 'carga',
    aliases: ['peso-carga', 'kg'],
    usage: 'carga <kg|+5|-5>',
    help: 'Ajusta la carga. En fondos: «carga asistencia 20», «carga lastre 10» o «carga libre».',
    run: ([v, amount]) => {
      const { id, mod, st } = activeStation();
      const label = (kg: number) => {
        const l = loadValueLabel(mod.logic.load, kg);
        return `${l.value} ${l.unit}`;
      };
      if (!v) return `Carga actual: ${label(st.loadKg)}`;
      // Admite el signo menos tipográfico (−) que muestra la propia interfaz.
      v = v.replace(/\u2212/g, '-');
      const mode = norm(v);
      if (mode === 'asistencia' || mode === 'lastre' || mode === 'libre') {
        if (mod.logic.load.kind !== 'corporal') return fail('Asistencia y lastre solo existen en las estaciones de peso corporal.');
        const a = mode === 'libre' ? 0 : Math.abs(Number((amount ?? '').replace(',', '.')));
        if (!Number.isFinite(a) || (mode !== 'libre' && !amount)) return fail(`Indica los kg: «carga ${mode} 20».`);
        useApp.getState().update(id, { loadKg: mode === 'asistencia' ? -a : a });
        return `Carga: ${label(settingsFor(useApp.getState(), id).loadKg)}`;
      }
      const n = Number(v.replace(',', '.'));
      if (!Number.isFinite(n)) return fail('Número no válido.');
      const kg = /^[+-]/.test(v) ? st.loadKg + n : n;
      useApp.getState().update(id, { loadKg: kg });
      return `Carga: ${label(settingsFor(useApp.getState(), id).loadKg)}`;
    },
  },
  {
    name: 'error',
    aliases: ['demo'],
    usage: 'error <id|ninguno>',
    help: 'Demuestra un error típico (o vuelve a la técnica ideal).',
    complete: () => {
      const s = useApp.getState();
      if (s.route.name !== 'station') return [];
      const st = settingsFor(s, s.route.id);
      return ['ninguno', ...findVariant(getModule(s.route.id)!.content, st.variantId).errors];
    },
    run: ([id]) => {
      const { id: sid, mod, st } = activeStation();
      const variant = findVariant(mod.content, st.variantId);
      if (!id) return ['Errores demostrables:', ...variant.errors.map((e) => `  ${e.padEnd(18)} ${mod.content.errors.find((x) => x.id === e)?.label ?? ''}`)];
      if (['ninguno', 'ideal', 'off'].includes(norm(id))) {
        useApp.getState().update(sid, { errorId: null });
        return 'Técnica ideal.';
      }
      if (!variant.errors.includes(norm(id))) return fail(`Error «${id}» no disponible en esta variante.`);
      useApp.getState().update(sid, { errorId: norm(id) });
      return `Demostrando: ${mod.content.errors.find((e) => e.id === norm(id))?.label}`;
    },
  },
  {
    name: 'tempo',
    usage: 'tempo <exc-pausa-conc-pausa>',
    help: 'Tempo en segundos, p. ej. 3-1-1-1.',
    run: ([t]) => {
      const { id, st } = activeStation();
      if (!t) return `Tempo: ${tempoToString(st.tempo)}`;
      const tempo = parseTempo(t) ?? fail('Formato: 4 cifras, p. ej. 3-1-1-1.');
      useApp.getState().update(id, { tempo });
      return `Tempo: ${tempoToString(tempo)}`;
    },
  },
  {
    name: 'reps',
    usage: 'reps <1–10>',
    help: 'Número de repeticiones de la serie.',
    run: ([n]) => {
      const { id } = activeStation();
      const r = Math.round(Number(n));
      if (!(r >= 1 && r <= 10)) return fail('Entre 1 y 10.');
      useApp.getState().update(id, { reps: r });
      return `Repeticiones: ${r}`;
    },
  },
  {
    name: 'vista',
    aliases: ['camara'],
    usage: 'vista <id>',
    help: 'Cambia la cámara (isométrica, lateral…).',
    complete: () => {
      const s = useApp.getState();
      return s.route.name === 'station' ? getModule(s.route.id)!.content.views.map((v) => v.id) : [];
    },
    run: ([v]) => {
      const { id, mod } = activeStation();
      if (!v) return mod.content.views.map((x) => `  ${x.id.padEnd(12)} ${x.label}`);
      const view = mod.content.views.find((x) => x.id === norm(v)) ?? fail(`Vista «${v}» no existe.`);
      useApp.getState().update(id, { viewId: view.id, azimuthOffset: 0 });
      return `Vista: ${view.label}`;
    },
  },
  {
    name: 'girar',
    usage: 'girar <grados>',
    help: 'Gira la cámara alrededor del eje vertical.',
    run: ([g]) => {
      const { id, st } = activeStation();
      const n = Number(g);
      if (!Number.isFinite(n)) return fail('Indica grados, p. ej. «girar 45».');
      useApp.getState().update(id, { azimuthOffset: st.azimuthOffset + n });
      return `Giro: ${st.azimuthOffset + n}°`;
    },
  },
  {
    name: 'play',
    aliases: ['reproducir'],
    usage: 'play',
    help: 'Reproduce la serie.',
    run: () => {
      bridge.player?.play();
      return '▶';
    },
  },
  {
    name: 'pausa',
    aliases: ['pause', 'stop'],
    usage: 'pausa',
    help: 'Pausa la serie.',
    run: () => {
      bridge.player?.pause();
      return '❚❚';
    },
  },
  {
    name: 'fase',
    usage: 'fase <siguiente|anterior|inicio>',
    help: 'Salta entre fases del guion.',
    complete: () => ['siguiente', 'anterior', 'inicio'],
    run: ([dir]) => {
      activeStation();
      const cur = bridge.current ?? fail('Reproductor no listo.');
      const segs = cur.timeline.segments;
      const d = norm(dir ?? 'siguiente');
      const i = d.startsWith('ant') ? Math.max(0, cur.state.index - 1) : d === 'inicio' ? 0 : Math.min(segs.length - 1, cur.state.index + 1);
      const seg = segs[i]!;
      bridge.player?.pause();
      bridge.player?.seekTo(Math.round(seg.start * bridge.fps) + 1);
      return `${PHASE_LABEL[seg.kind]}${seg.rep ? ` · rep ${seg.rep}` : ''}`;
    },
  },
  {
    name: 'velocidad',
    aliases: ['speed'],
    usage: 'velocidad <0.25–2>',
    help: 'Velocidad de reproducción.',
    run: ([v]) => {
      const n = Number((v ?? '').replace(',', '.'));
      if (!(n >= 0.25 && n <= 2)) return fail('Entre 0.25 y 2.');
      useFrame.setState({ rate: n });
      return `Velocidad ×${n}`;
    },
  },
  {
    name: 'angulos',
    aliases: ['articulaciones'],
    usage: 'angulos',
    help: 'Lectura de las articulaciones en el fotograma actual.',
    run: () => {
      activeStation();
      const cur = bridge.current ?? fail('Reproductor no listo.');
      const lines = [`${PHASE_LABEL[cur.state.kind]} · progreso ${(cur.state.p * 100).toFixed(0)}%`];
      for (const e of cur.result.evaluations) {
        const icon = e.status === 'ok' ? '✔' : e.status === 'aviso' ? '▲' : '✖';
        lines.push(`  ${icon} ${e.window.label}${e.side ? ` (${e.side === 'L' ? 'izq' : 'der'})` : ''}: ${e.value.toFixed(1)}° [ok ${e.window.ok[0]}…${e.window.ok[1]}]`);
      }
      return lines;
    },
  },
  {
    name: 'guion',
    usage: 'guion',
    help: 'Señales técnicas de la fase actual.',
    run: () => {
      const { mod, st } = activeStation();
      const cur = bridge.current ?? fail('Reproductor no listo.');
      const v = findVariant(mod.content, st.variantId);
      return [PHASE_LABEL[cur.state.kind], ...(v.cues[cur.state.kind] ?? []).map((c) => `  · ${c}`)];
    },
  },
  {
    name: 'ajuste',
    aliases: ['setup'],
    usage: 'ajuste',
    help: 'Ajuste de la máquina para tu antropometría.',
    run: () => {
      activeStation();
      const cur = bridge.current ?? fail('Reproductor no listo.');
      return cur.result.setup.map((l) => `  ${l.label}: ${l.value}${l.note ? ` — ${l.note}` : ''}`);
    },
  },
  {
    name: 'musculos',
    usage: 'musculos',
    help: 'Músculos implicados en la variante.',
    run: () => {
      const { mod, st } = activeStation();
      const v = findVariant(mod.content, st.variantId);
      return v.muscles.map((m) => `  ${'■'.repeat(m.level).padEnd(3)} ${MUSCLES[m.muscle].name} — ${ROLE_LABEL[m.role]}`);
    },
  },
  {
    name: 'momentos',
    usage: 'momentos',
    help: 'Demanda articular estimada (N·m).',
    run: () => {
      activeStation();
      const cur = bridge.current ?? fail('Reproductor no listo.');
      return Object.entries(cur.result.moments)
        .filter(([, v]) => v > 0.5)
        .map(([k, v]) => `  ${JOINT_MOMENT_LABEL[k as keyof typeof JOINT_MOMENT_LABEL].padEnd(8)} ${v.toFixed(0)} N·m`);
    },
  },
  {
    name: 'altura',
    usage: 'altura <cm>',
    help: 'Tu talla (140–210 cm).',
    run: ([v]) => {
      const n = Number(v);
      if (!(n >= 140 && n <= 210)) return fail('Entre 140 y 210 cm.');
      useApp.getState().setAnthro({ heightCm: n });
      return `Talla: ${n} cm`;
    },
  },
  {
    name: 'masa',
    aliases: ['peso'],
    usage: 'masa <kg>',
    help: 'Tu masa corporal (40–160 kg).',
    run: ([v]) => {
      const n = Number(v);
      if (!(n >= 40 && n <= 160)) return fail('Entre 40 y 160 kg.');
      useApp.getState().setAnthro({ massKg: n });
      return `Masa: ${n} kg`;
    },
  },
  {
    name: 'movilidad',
    usage: 'movilidad <cadera|tobillo> <grados>',
    help: 'Tu flexión de cadera / flexión dorsal máximas.',
    complete: (args) => (args.length <= 1 ? ['cadera', 'tobillo'] : []),
    run: ([j, v]) => {
      const n = Number(v);
      if (norm(j ?? '') === 'cadera') {
        if (!(n >= 80 && n <= 140)) return fail('Cadera: entre 80 y 140°.');
        useApp.getState().setAnthro({ hipFlexionMax: n });
        return `Flexión de cadera máx.: ${n}°`;
      }
      if (norm(j ?? '') === 'tobillo') {
        if (!(n >= 15 && n <= 55)) return fail('Tobillo: entre 15 y 55°.');
        useApp.getState().setAnthro({ ankleDorsiMax: n });
        return `Flexión dorsal máx.: ${n}°`;
      }
      return fail('Usa «movilidad cadera 115» o «movilidad tobillo 38».');
    },
  },
  {
    name: 'perfil',
    usage: 'perfil',
    help: 'Abre el panel de antropometría.',
    run: () => {
      useApp.getState().set({ anthroOpen: true });
      const a = useApp.getState().anthro;
      return `Talla ${a.heightCm} cm · masa ${a.massKg} kg · cadera ${a.hipFlexionMax}° · tobillo ${a.ankleDorsiMax}°`;
    },
  },
  {
    name: 'tema',
    usage: 'tema <auto|oscuro|claro|terminal>',
    help: 'Cambia el tema visual (auto sigue al sistema).',
    complete: () => ['auto', 'oscuro', 'claro', 'terminal'],
    run: ([t]) => {
      const n = norm(t ?? '');
      if (n === 'auto') {
        useApp.getState().chooseTheme('auto');
        return 'Tema: automático';
      }
      if (!['oscuro', 'claro', 'terminal'].includes(n)) return fail('Temas: auto, oscuro, claro, terminal.');
      useApp.getState().chooseTheme(n as ThemeId);
      return `Tema: ${n}`;
    },
  },
  {
    name: 'mostrar',
    usage: 'mostrar <musculos|transportadores|rotulos> <si|no>',
    help: 'Capas de la escena.',
    complete: (args) => (args.length <= 1 ? ['musculos', 'transportadores', 'rotulos'] : ['si', 'no']),
    run: ([what, v]) => {
      const on = BOOL(v);
      const w = norm(what ?? '');
      if (w.startsWith('mus')) useApp.getState().set({ showMuscles: on });
      else if (w.startsWith('trans') || w.startsWith('ang')) useApp.getState().set({ showGauges: on });
      else if (w.startsWith('rot')) useApp.getState().set({ showOverlay: on });
      else return fail('Capas: musculos, transportadores, rotulos.');
      return `${what}: ${on ? 'sí' : 'no'}`;
    },
  },
  {
    name: 'exportar',
    aliases: ['video'],
    usage: 'exportar',
    help: 'Cómo exportar la serie actual a vídeo MP4 con Remotion.',
    run: () => {
      const { id, st } = activeStation();
      const s = useApp.getState();
      const props = JSON.stringify({ ...st, stationId: id, anthro: s.anthro, theme: s.theme, showMuscles: s.showMuscles, showGauges: s.showGauges, showOverlay: true });
      return ['Desde el repositorio:', `  npx remotion render src/remotion/index.ts ${compositionId(id, st.variantId)} out/${id}.mp4 --props='${props}'`];
    },
  },
  {
    name: 'limpiar',
    aliases: ['clear', 'cls'],
    usage: 'limpiar',
    help: 'Limpia la consola.',
    run: () => {
      useApp.getState().clearLog();
    },
  },
];

export function findCommand(name: string): Command | undefined {
  const n = norm(name);
  return COMMANDS.find((c) => c.name === n || c.aliases?.includes(n));
}

export function runCommand(line: string) {
  const app = useApp.getState();
  const text = line.trim();
  if (!text) return;
  app.print({ kind: 'in', text });
  const [name, ...args] = text.split(/\s+/);
  const cmd = findCommand(name!);
  if (!cmd) {
    app.print({ kind: 'err', text: `Comando desconocido «${name}». Escribe «ayuda».` });
    return;
  }
  try {
    const out = cmd.run(args);
    if (out === undefined) return;
    const lines = Array.isArray(out) ? out : [out];
    useApp.getState().print(...lines.map((t) => ({ kind: 'out' as const, text: t })));
  } catch (e) {
    useApp.getState().print({ kind: 'err', text: e instanceof CmdError ? e.message : String(e) });
  }
}

/** Autocompletado: devuelve candidatos para la línea completa. */
export function completions(line: string): string[] {
  const parts = line.split(/\s+/);
  if (parts.length <= 1) {
    const p = norm(parts[0] ?? '');
    return COMMANDS.map((c) => c.name).filter((n) => n.startsWith(p));
  }
  const cmd = findCommand(parts[0]!);
  if (!cmd?.complete) return [];
  const args = parts.slice(1);
  const last = norm(args[args.length - 1] ?? '');
  const prefix = parts.slice(0, -1).join(' ');
  return cmd
    .complete(args)
    .filter((c) => norm(c).startsWith(last))
    .map((c) => `${prefix} ${c}`);
}

