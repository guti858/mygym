// Simula el visor de Claude: tema del anfitrión en data-theme y sin historial disponible.
// Uso: node scripts/screenshot-host.mjs <url> <salida.png> <light|dark> [ancho] [alto]
import { chromium } from '@playwright/test';

const [, , url, out, hostTheme, w = '1440', h = '900'] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript((t) => {
  const apply = () => document.documentElement.setAttribute('data-theme', t);
  if (document.documentElement) apply();
  else
    new MutationObserver((_, o) => {
      if (document.documentElement) {
        apply();
        o.disconnect();
      }
    }).observe(document, { childList: true });
  history.pushState = () => {
    throw new DOMException('bloqueado', 'SecurityError');
  };
  history.replaceState = () => {
    throw new DOMException('bloqueado', 'SecurityError');
  };
}, hostTheme);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.locator('.card', { hasText: 'Prensa de piernas' }).click();
await page.waitForTimeout(4000);
await page.screenshot({ path: out });
console.log(errors.join('\n') || 'sin errores');
await browser.close();
