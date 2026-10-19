import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];

async function open(page: Page, hash: string) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/${hash}`);
}

test('el gimnasio lista las 12 estaciones y navega a una disponible', async ({ page }) => {
  await open(page, '#/');
  await expect(page.getByRole('heading', { name: /Cada articulación/i })).toBeVisible();
  await expect(page.locator('.card')).toHaveCount(12);
  await expect(page.locator('.card:not(.card--soon)')).toHaveCount(10);
  await page.locator('.card', { hasText: 'Jalón al pecho' }).click();
  await expect(page).toHaveURL(/#\/e\/jalon/);
  await expect(page.locator('.stage canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('filtro por músculo resalta estaciones', async ({ page }) => {
  await open(page, '#/');
  // Cada región es un <g> con dos formas (izquierda y derecha): su centro cae en otra región, así que se dispara el clic sobre el propio elemento.
  await page.getByRole('button', { name: 'Cuádriceps' }).first().dispatchEvent('click');
  await expect(page.locator('.card--principal', { hasText: 'Prensa' })).toBeVisible();
});

test('jalón: variante, carga y error se reflejan en la URL y en el guion', async ({ page, isMobile }) => {
  await open(page, '#/e/jalon');
  await expect(page.locator('.stage canvas')).toBeVisible();
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
  await page.getByRole('radio', { name: /Supino/ }).click();
  await expect(page).toHaveURL(/v=supino-estrecho/);
  await page.getByRole('button', { name: 'Más carga' }).click();
  await expect(page).toHaveURL(/kg=45/);
  await page.getByRole('button', { name: /Hombros encogidos/ }).click();
  await expect(page).toHaveURL(/err=encogimiento/);
  await page.getByRole('tab', { name: /Guion/ }).click();
  await expect(page.getByRole('heading', { name: /Demostración de error · Hombros encogidos/ })).toBeVisible();
  await page.getByRole('tab', { name: /Articulaciones/ }).click();
  await expect(page.locator('.joint').first()).toBeVisible();
  await page.screenshot({ path: `test-results/jalon-${isMobile ? 'movil' : 'escritorio'}.png` });
  expect(errors).toEqual([]);
});

test('press de banca: agarre y error en la URL; barra en el ajuste', async ({ page, isMobile }) => {
  await open(page, '#/e/press_banca');
  await expect(page.locator('.stage canvas')).toBeVisible();
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
  await expect(page.locator('.fine', { hasText: 'Barra 20 kg' })).toBeVisible();
  await page.getByRole('radio', { name: /Agarre cerrado/ }).click();
  await expect(page).toHaveURL(/v=cerrado/);
  await page.getByRole('button', { name: /Escápulas sueltas/ }).click();
  await expect(page).toHaveURL(/err=escapulas_sueltas/);
  await page.getByRole('tab', { name: /Articulaciones/ }).click();
  await expect(page.locator('.joint').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('fondos: la carga pasa de asistencia a lastre', async ({ page, isMobile }) => {
  await open(page, '#/e/fondos');
  await expect(page.locator('.stage canvas')).toBeVisible();
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
  const value = page.locator('.stepper__value');
  await expect(value).toContainText('libre');
  await page.getByRole('button', { name: 'Menos carga' }).click();
  await expect(value).toContainText('asistencia');
  await expect(page).toHaveURL(/kg=-5/);
  await page.getByRole('button', { name: 'Más carga' }).click();
  await page.getByRole('button', { name: 'Más carga' }).click();
  await expect(value).toContainText('lastre');
  await page.getByRole('radio', { name: /Tríceps/ }).click();
  await expect(page).toHaveURL(/v=triceps/);
  expect(errors).toEqual([]);
});

test('dominadas: agarre y error en la URL', async ({ page, isMobile }) => {
  await open(page, '#/e/dominadas');
  await expect(page.locator('.stage canvas')).toBeVisible();
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
  await page.getByRole('radio', { name: /Supina/ }).click();
  await expect(page).toHaveURL(/v=supina/);
  await page.getByRole('button', { name: /Kipping/ }).click();
  await expect(page).toHaveURL(/err=kipping/);
  expect(errors).toEqual([]);
});

test('remo en T: palanca en la carga y error en la URL', async ({ page, isMobile }) => {
  await open(page, '#/e/remo_t?v=libre-neutro');
  await expect(page.locator('.stage canvas')).toBeVisible();
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
  await expect(page.locator('.fine', { hasText: 'Palanca 10 kg' })).toBeVisible();
  await page.getByRole('button', { name: /Espalda redondeada/ }).click();
  await expect(page).toHaveURL(/err=espalda_redondeada/);
  expect(errors).toEqual([]);
});

test('poleas: modalidad sobre la cabeza y polea 2:1', async ({ page, isMobile }) => {
  await open(page, '#/e/poleas?v=triceps-cabeza');
  await expect(page.locator('.stage canvas')).toBeVisible();
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
  await expect(page.locator('.fine', { hasText: 'polea 2:1' })).toBeVisible();
  await page.getByRole('button', { name: /Arco lumbar/ }).click();
  await expect(page).toHaveURL(/err=arco_lumbar/);
  expect(errors).toEqual([]);
});

test('la consola ejecuta comandos', async ({ page, isMobile }) => {
  test.skip(isMobile, 'La consola se prueba con teclado físico en escritorio');
  await open(page, '#/');
  await page.keyboard.press(':');
  const input = page.locator('#console-input');
  await expect(input).toBeFocused();
  await input.fill('ir prensa');
  await input.press('Enter');
  await expect(page).toHaveURL(/#\/e\/prensa/);
  await input.fill('carga 80');
  await input.press('Enter');
  await expect(page).toHaveURL(/kg=80/);
  await input.fill('variante altos');
  await input.press('Enter');
  await expect(page).toHaveURL(/v=altos/);
  await input.fill('angulos');
  await input.press('Enter');
  await expect(page.locator('.console__log')).toContainText('Rodilla');
  await input.fill('ajuste');
  await input.press('Enter');
  await expect(page.locator('.console__log')).toContainText('Profundidad recomendada');
  await page.screenshot({ path: 'test-results/prensa-consola.png' });
  await input.fill('ir peck_deck');
  await input.press('Enter');
  await expect(page).toHaveURL(/#\/e\/peck_deck/);
  await input.fill('variante pajaro');
  await input.press('Enter');
  await expect(page).toHaveURL(/v=pajaro/);
  expect(errors).toEqual([]);
});

test('el perfil antropométrico cambia el ajuste de la máquina', async ({ page, isMobile }) => {
  await open(page, '#/e/prensa?v=medios');
  await page.getByRole('tab', { name: 'Máquina' }).click();
  const depth = page.locator('.setup li', { hasText: 'Profundidad recomendada' });
  const before = await depth.innerText();
  await page.getByTitle('Antropometría y movilidad').click();
  await page.getByRole('button', { name: 'Poca movilidad' }).click();
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
  await expect(depth).not.toHaveText(before);
  if (!isMobile) await page.screenshot({ path: 'test-results/prensa-perfil.png' });
});
