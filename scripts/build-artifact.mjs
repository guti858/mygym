// Genera dist/artifact.html: la app compilada lista para publicarse como página de Claude
// (sin <!doctype>/<html>/<head>/<body>, que añade el visor). Ejecutar después de `npm run build`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const pick = (re) => [...html.matchAll(re)].map((m) => m[1]);
const scripts = pick(/<script type="module"[^>]*src="([^"]+)"/g);
const preloads = pick(/<link rel="modulepreload"[^>]*href="([^"]+)"/g);
const styles = pick(/<link rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+)"/g);
const fonts = pick(/<link href="(https:\/\/fonts\.googleapis\.com[^"]+)"/g);
// Script en línea que fija el tema antes del primer pintado (sin destello oscuro → claro).
const themeScript = html.match(/<script>\/\* Tema antes del primer pintado[\s\S]*?<\/script>/)?.[0] ?? '';

const page = `<title>MyGym</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Gimnasio isométrico con guion articular: técnica fase a fase, rangos seguros y errores típicos en cada máquina.">
${themeScript}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts.map((f) => `<link rel="stylesheet" href="${f}">`).join('\n')}
${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
${preloads.map((p) => `<link rel="modulepreload" href="${p}">`).join('\n')}
<div id="root"></div>
${scripts.map((s) => `<script type="module" src="${s}"></script>`).join('\n')}
`;
writeFileSync('dist/artifact.html', page);
const assets = readdirSync('dist/assets');
console.log('dist/artifact.html');
console.log(JSON.stringify(Object.fromEntries(assets.map((a) => [`assets/${a}`, `dist/assets/${a}`])), null, 2));
