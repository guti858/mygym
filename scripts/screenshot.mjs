// Captura de pantalla de la app con Chromium (WebGL por SwiftShader).
// Uso: node scripts/screenshot.mjs <url> <salida.png> [ancho] [alto] [espera_ms]
import { chromium } from '@playwright/test';

const [, , url, out, w = '1440', h = '900', wait = '2500'] = process.argv;
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(+wait);
await page.screenshot({ path: out, fullPage: false });
console.log(errors.slice(0, 15).join('\n') || 'sin errores');
await browser.close();
