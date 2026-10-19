// Captura con un tema preseleccionado (guardado en localStorage antes de cargar la app).
// Uso: node scripts/screenshot-theme.mjs <url> <salida.png> <tema> [ancho] [alto]
import { chromium } from '@playwright/test';

const [, , url, out, theme, w = '1440', h = '900'] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.addInitScript((t) => localStorage.setItem('mygym:v1', JSON.stringify({ theme: t })), theme);
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await page.screenshot({ path: out });
await browser.close();
