import { expect, test, type Page } from '@playwright/test';

const errors: string[] = [];

async function open(page: Page, hash: string) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/${hash}`);
}

/** En escritorio los ajustes están siempre a la vista; en móvil, en su pestaña. */
async function settings(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('tab', { name: 'Ajustes' }).click();
}

/** Errores, guion y articulaciones: pestaña Técnica. */
async function technique(page: Page) {
  await page.getByRole('tab', { name: 'Técnica' }).click();
}

test('el gimnasio lista las 12 estaciones y navega a una disponible', async ({ page }) => {
  await open(page, '#/');
  await expect(page.getByRole('heading', { name: /Cada articulación/i })).toBeVisible();
  await expect(page.locator('.st-chip')).toHaveCount(12);
  await expect(page.locator('.st-chip[aria-disabled="true"]')).toHaveCount(0);
  await page.locator('.st-chip', { hasText: 'Jalón al pecho' }).click();
  await expect(page).toHaveURL(/#\/e\/jalon/);
  await expect(page.locator('.stage canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('filtro por músculo resalta estaciones', async ({ page }) => {
  await open(page, '#/');
  // Cada región incluye los dos lados del cuerpo: su centro cae entre las piernas, así que se dispara el clic sobre el propio elemento.
  await page.getByRole('button', { name: 'Cuádriceps' }).first().dispatchEvent('click');
  await expect(page.locator('.st-chip--principal', { hasText: 'Prensa' })).toBeVisible();
  // El selector filtra igual que el mapa (y queda cuando no hay alto para el mapa).
  await page.getByRole('combobox', { name: 'Músculo' }).selectOption({ label: 'Dorsal ancho' });
  await expect(page.locator('.st-chip--principal', { hasText: 'Jalón al pecho' })).toBeVisible();
  await expect(page.locator('.st-chip--principal', { hasText: 'Prensa' })).toHaveCount(0);
});

test('jalón: variante, carga y error se reflejan en la URL y en el guion', async ({ page, isMobile }) => {
  await open(page, '#/e/jalon');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
  await page.getByRole('radio', { name: /Supino/ }).click();
  await expect(page).toHaveURL(/v=supino-estrecho/);
  await page.getByRole('button', { name: 'Más carga' }).click();
  await expect(page).toHaveURL(/kg=45/);
  await technique(page);
  await page.getByRole('button', { name: /Hombros encogidos/ }).click();
  await expect(page).toHaveURL(/err=encogimiento/);
  await expect(page.getByRole('heading', { name: /Demostración de error · Hombros encogidos/ })).toBeAttached();
  await expect(page.locator('.callout--risk')).toContainText('Corrige:');
  await expect(page.locator('.joint').first()).toBeVisible();
  await page.screenshot({ path: `test-results/jalon-${isMobile ? 'movil' : 'escritorio'}.png` });
  expect(errors).toEqual([]);
});

test('press de banca: agarre y error en la URL; barra en el ajuste', async ({ page, isMobile }) => {
  await open(page, '#/e/press_banca');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
  await expect(page.locator('.fine', { hasText: 'Barra 20 kg' })).toBeVisible();
  await page.getByRole('radio', { name: /Agarre cerrado/ }).click();
  await expect(page).toHaveURL(/v=cerrado/);
  await technique(page);
  await page.getByRole('button', { name: /Escápulas sueltas/ }).click();
  await expect(page).toHaveURL(/err=escapulas_sueltas/);
  await expect(page.locator('.joint').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('fondos: la carga pasa de asistencia a lastre', async ({ page, isMobile }) => {
  await open(page, '#/e/fondos');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
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
  await settings(page, isMobile);
  await page.getByRole('radio', { name: /Supina/ }).click();
  await expect(page).toHaveURL(/v=supina/);
  await technique(page);
  await page.getByRole('button', { name: /Kipping/ }).click();
  await expect(page).toHaveURL(/err=kipping/);
  expect(errors).toEqual([]);
});

test('remo en T: palanca en la carga y error en la URL', async ({ page, isMobile }) => {
  await open(page, '#/e/remo_t?v=libre-neutro');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
  await expect(page.locator('.fine', { hasText: 'Palanca 10 kg' })).toBeVisible();
  await technique(page);
  await page.getByRole('button', { name: /Espalda redondeada/ }).click();
  await expect(page).toHaveURL(/err=espalda_redondeada/);
  expect(errors).toEqual([]);
});

test('poleas: modalidad sobre la cabeza y polea 2:1', async ({ page, isMobile }) => {
  await open(page, '#/e/poleas?v=triceps-cabeza');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
  await expect(page.locator('.fine', { hasText: 'polea 2:1' })).toBeVisible();
  await technique(page);
  await page.getByRole('button', { name: /Arco lumbar/ }).click();
  await expect(page).toHaveURL(/err=arco_lumbar/);
  expect(errors).toEqual([]);
});

test('abductores / aductores: modalidad y error en la URL', async ({ page, isMobile }) => {
  await open(page, '#/e/abd_add');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
  await page.getByRole('radio', { name: /^Aducción/ }).click();
  await expect(page).toHaveURL(/v=aduccion/);
  await technique(page);
  await page.getByRole('button', { name: /Pelvis que bascula/ }).click();
  await expect(page).toHaveURL(/err=pelvis/);
  expect(errors).toEqual([]);
});

test('mancuernas: ejercicio, carga por mancuerna y error', async ({ page, isMobile }) => {
  await open(page, '#/e/mancuernas?v=goblet');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await settings(page, isMobile);
  await expect(page.locator('.stepper__value')).toContainText('kg / mancuerna');
  await technique(page);
  await page.getByRole('button', { name: /Rodillas hacia dentro/ }).click();
  await expect(page).toHaveURL(/err=valgo/);
  await settings(page, isMobile);
  await page.getByRole('radio', { name: /Remo unilateral/ }).click();
  await expect(page).toHaveURL(/v=remo/);
  await expect(page).not.toHaveURL(/err=/);
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

test('cámara: giro, inclinación y ajuste a la vista se guardan en el enlace', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Teclado y consola se prueban en escritorio');
  await open(page, '#/e/jalon?vista=iso');
  const stage = page.locator('.stage');
  await expect(stage.locator('canvas')).toBeVisible();
  // Teclado sobre la escena: → gira 15°, ↑ inclina 10°; Inicio vuelve a la vista.
  await stage.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(page).toHaveURL(/giro=15/);
  await expect(page).toHaveURL(/incl=10/);
  await page.keyboard.press('Home');
  await expect(page).not.toHaveURL(/giro=|incl=/);
  // Consola: la elevación no pasa de 89° (vista cenital).
  await page.keyboard.press(':');
  const input = page.locator('#console-input');
  await input.fill('inclinar 90');
  await input.press('Enter');
  await expect(page.locator('.console__log')).toContainText('Elevación: 89°');
  await input.fill('vista lateral');
  await input.press('Enter');
  await expect(page).toHaveURL(/vista=lateral/);
  await expect(page).not.toHaveURL(/incl=/);
  // Un enlace con ángulo abre la estación con ese ángulo.
  await open(page, '#/e/jalon?vista=lateral&giro=-30');
  await expect(page).toHaveURL(/giro=-30/);
  expect(errors).toEqual([]);
});

test('gimnasio → estación: clic elige la máquina, «Abrir estación» se acerca a ella y la vista del gimnasio se conserva al volver', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Se pulsa la máquina en el plano 3D con ratón');
  await open(page, '#/');
  await expect(page.locator('.hub__player canvas')).toBeVisible();
  const label = page.locator('.hub__player div', { hasText: /^Jalón al pecho$/ }).first();
  await expect(label).toBeVisible();
  const box = (await label.boundingBox())!;
  // La máquina queda justo debajo de su rótulo. El rótulo (HTML) puede verse antes de que la escena
  // 3D acepte clics en un runner lento: se reintenta hasta que aparece la tarjeta de la máquina.
  const card = page.getByRole('group', { name: /Jalón al pecho: estación elegida/ });
  await expect(async () => {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + 45);
    await expect(card).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 45_000 });
  // Un clic solo elige: la estación no se abre hasta pedirlo.
  await expect(page).not.toHaveURL(/#\/e\//);
  await card.getByRole('button', { name: 'Abrir estación' }).click();
  await expect(page).toHaveURL(/#\/e\/jalon/, { timeout: 30_000 });
  // La copia del plano se retira cuando la estación ya ha pintado.
  await expect(page.locator('.zoom-snap')).toHaveCount(0, { timeout: 60_000 });
  await expect(page.locator('.stage canvas')).toBeVisible();
  await page.goBack();
  await expect(page.locator('.hub__player canvas')).toBeVisible();
  // Ningún lienzo se ha destruido ni recreado: el del gimnasio y el de la estación siguen ahí.
  await expect(page.locator('canvas')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('plano del gimnasio: barra de vista (zoom, planta, vista de arranque), teclado y consola', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Teclado y consola se prueban en escritorio');
  // Sin animaciones: la cámara salta y la estación se abre sin acercamiento.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '#/');
  const plan = page.locator('.hub__player');
  await expect(plan.locator('canvas')).toBeVisible();
  const bar = page.getByRole('toolbar', { name: 'Vista del plano' });
  await bar.getByRole('button', { name: 'Acercar' }).click();
  await expect(plan).toHaveClass(/is-zoomed/);
  await bar.getByRole('radio', { name: 'Planta' }).click();
  await expect(bar.getByRole('radio', { name: 'Planta' })).toHaveAttribute('aria-checked', 'true');
  await expect(plan).not.toHaveClass(/is-zoomed/);
  await bar.getByRole('button', { name: 'Acercar' }).click();
  await bar.getByRole('button', { name: 'Vista de arranque' }).click();
  await expect(bar.getByRole('radio', { name: /Isométrica 1/ })).toHaveAttribute('aria-checked', 'true');
  await expect(plan).not.toHaveClass(/is-zoomed/);
  // Capas: los rótulos de las máquinas se pueden ocultar.
  await bar.getByRole('button', { name: /^Capas/ }).click();
  await page.getByRole('checkbox', { name: 'Rótulos de las máquinas' }).uncheck();
  await expect(plan.locator('div', { hasText: /^Jalón al pecho$/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Rótulos de las máquinas' }).check();
  await page.keyboard.press('Escape');
  // Teclado: flechas eligen una máquina (tarjeta), Esc la suelta, Intro abre la elegida.
  await plan.focus();
  await page.keyboard.press('ArrowRight');
  const card = page.getByRole('group', { name: /estación elegida/ });
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  const name = (await card.getByRole('heading').innerText()).toLowerCase();
  expect(name.length).toBeGreaterThan(3);
  await page.keyboard.press('+');
  await expect(plan).toHaveClass(/is-zoomed/);
  await page.keyboard.press('0');
  await expect(plan).not.toHaveClass(/is-zoomed/);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/e\//);
  // Consola en el gimnasio: vistas del plano y zoom.
  await page.goto('/#/');
  await expect(plan.locator('canvas')).toBeVisible();
  await page.keyboard.press(':');
  const input = page.locator('#console-input');
  await input.fill('vista iso3');
  await input.press('Enter');
  await expect(bar.getByRole('radio', { name: /Isométrica 3/ })).toHaveAttribute('aria-checked', 'true');
  await input.fill('zoom 2');
  await input.press('Enter');
  await expect(plan).toHaveClass(/is-zoomed/);
  await expect(page.locator('.console__log')).toContainText('Zoom del plano: 2');
  expect(errors).toEqual([]);
});

test('gimnasio: recorrido guiado, mini-mapa con zoom, ambiente y reflejo vivo en la estación', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Consola y mini-mapa se prueban en escritorio');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '#/');
  const plan = page.locator('.hub__player');
  await expect(plan.locator('canvas')).toBeVisible();
  // Recorrido guiado: seis paradas en el orden de una sesión; con «reducir movimiento» no avanza solo.
  await page.getByRole('button', { name: /Recorrido guiado/ }).click();
  const tour = page.getByRole('region', { name: 'Recorrido guiado' });
  await expect(tour).toContainText('paso 1 de 6');
  await expect(tour.getByRole('heading')).toContainText('Cardio');
  await tour.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(tour.getByRole('heading')).toContainText('Empuje');
  await expect(tour.getByRole('button', { name: 'Press de banca' })).toBeVisible();
  // Cualquier cambio de la vista (aquí, el zoom) acaba el recorrido.
  const bar = page.getByRole('toolbar', { name: 'Vista del plano' });
  await bar.getByRole('button', { name: 'Acercar' }).click();
  await expect(tour).toHaveCount(0);
  // Con zoom aparece el mini-mapa.
  await expect(page.getByRole('img', { name: /Mini-mapa del gimnasio/ })).toBeVisible();
  await bar.getByRole('button', { name: 'Vista de arranque' }).click();
  await expect(page.getByRole('img', { name: /Mini-mapa del gimnasio/ })).toHaveCount(0);
  // Ambiente desde la consola (se guarda como preferencia).
  await page.keyboard.press(':');
  const input = page.locator('#console-input');
  await input.fill('ambiente noche');
  await input.press('Enter');
  await expect(page.locator('.console__log')).toContainText('Ambiente: Noche');
  await input.fill('recorrido');
  await input.press('Enter');
  await expect(tour).toContainText('paso 1 de 6');
  await input.fill('recorrido fin');
  await input.press('Enter');
  await expect(tour).toHaveCount(0);
  await page.keyboard.press('Escape');
  // Estación: el reflejo vivo en los espejos es una capa opcional.
  await page.goto('/#/e/jalon');
  await expect(page.locator('.stage canvas')).toBeVisible();
  const vbar = page.getByRole('toolbar', { name: 'Vista de la escena' });
  await vbar.getByRole('button', { name: /^(Capas|Más)/ }).click();
  const reflejo = page.getByRole('checkbox', { name: 'Reflejo en los espejos' });
  await expect(reflejo).not.toBeChecked();
  await reflejo.check();
  await expect(reflejo).toBeChecked();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('barra de vista sobre la escena: vistas, capas y giro', async ({ page }) => {
  await open(page, '#/e/jalon');
  await expect(page.locator('.stage canvas')).toBeVisible();
  const bar = page.getByRole('toolbar', { name: 'Vista de la escena' });
  await bar.getByRole('radio', { name: 'Lateral' }).click();
  await expect(page).toHaveURL(/vista=lateral/);
  // Giro y zoom: en la barra si la escena es ancha; si no, en el desplegable «Más».
  const more = bar.getByRole('button', { name: /^Más/ });
  if (await more.isVisible()) await more.click();
  await page.getByRole('button', { name: 'Girar 30° a la derecha' }).click();
  await expect(page).toHaveURL(/giro=30/);
  if (!(await page.getByRole('checkbox', { name: 'Ángulos' }).isVisible())) await bar.getByRole('button', { name: /^(Capas|Más)/ }).click();
  await page.getByRole('checkbox', { name: 'Ángulos' }).uncheck();
  await expect(page.locator('.joint__n:not(:empty)')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('checkbox', { name: 'Ángulos' })).toBeHidden();
  expect(errors).toEqual([]);
});

test('técnica: «Ir al momento» lleva a la fase en la que se ve el error', async ({ page }) => {
  await open(page, '#/e/jalon');
  await expect(page.locator('.stage canvas')).toBeVisible();
  await technique(page);
  await page.getByRole('button', { name: /Hombros encogidos/ }).click();
  await expect(page.locator('.callout--risk')).toContainText('Se ve en la contracción');
  await page.getByRole('button', { name: 'Ir al momento' }).click();
  // Pausa en la contracción: la fila de la articulación afectada pasa a evaluarse (y salta la alerta).
  await expect(page.locator('.phase-pill.is-on')).toHaveAccessibleName(/contracción|Concéntrica/);
  await expect(page.locator('.joint.is-affected.s-riesgo, .joint.is-affected.s-aviso').first()).toBeVisible();
  // La pauta de una articulación se abre sobre la lista y Esc la cierra.
  await page.locator('.joint.is-affected .joint__btn').first().click();
  await expect(page.getByRole('region', { name: /^Pauta:/ })).toContainText('Corrige:');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: /^Pauta:/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

/** Lista lo que se desplaza: la página o cualquier módulo marcado con data-fit. */
// (Se evalúa en el navegador: el texto evita depender de los tipos del DOM en los tests.)
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(`
    [document.scrollingElement, ...document.querySelectorAll('[data-fit]')]
      .filter((e) => e.checkVisibility())
      .filter((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
      .map((e) => (e.dataset?.fit ?? 'página') + ' ' + e.scrollHeight + '/' + e.clientHeight)
  `);
}

const STATIONS = ['dominadas', 'jalon', 'remo_t', 'poleas', 'prensa', 'abd_add', 'press_banca', 'press_inclinado', 'press_militar', 'peck_deck', 'fondos', 'mancuernas'];

for (const [w, h] of [
  [1440, 900],
  [1280, 720],
] as const) {
  test(`single-view a ${w}×${h}: ni la página ni ningún módulo se desplazan`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'Escritorio: en móvil solo se desplaza el panel de pestañas');
    test.setTimeout(600_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: w, height: h });
    await open(page, '#/');
    await expect(page.locator('.hub__player canvas')).toBeVisible();
    expect(await overflowing(page), 'gimnasio').toEqual([]);
    for (const id of STATIONS) {
      await page.goto(`/#/e/${id}`);
      await expect(page.locator('.stage canvas')).toBeVisible();
      // Se mide con el texto ya en su fuente definitiva (o en la de reserva, si la web no llega).
      await page.evaluate('document.fonts.ready');
      await technique(page);
      // Peor caso de la pestaña Técnica: cada error de la variante (y la técnica ideal).
      const chips = page.locator('.technique .chip');
      for (let i = 0, n = await chips.count(); i < n; i++) {
        await chips.nth(i).click();
        expect(await overflowing(page), `${id} · ${await chips.nth(i).innerText()}`).toEqual([]);
      }
      for (const tab of ['Músculos', 'Máquina']) {
        await page.getByRole('tab', { name: tab }).click();
        expect(await overflowing(page), `${id} · ${tab}`).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  });
}

test('móvil: la página no se desplaza (solo el panel de pestañas)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Disposición de móvil');
  await open(page, '#/e/press_banca');
  await expect(page.locator('.stage canvas')).toBeVisible();
  expect(await overflowing(page)).not.toContainEqual(expect.stringMatching(/^página/));
  await open(page, '#/');
  await expect(page.locator('.hub__player canvas')).toBeVisible();
  expect(await overflowing(page)).not.toContainEqual(expect.stringMatching(/^página/));
});
