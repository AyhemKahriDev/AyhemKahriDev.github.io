import { expect, test } from '@playwright/test';

test('loads original models and launches, flies, pauses and restarts without browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/3d.html');
  await expect(page.getByRole('button', { name: 'Launch mission' })).toBeEnabled();
  await page.screenshot({ path: 'art/title-screen.png' });
  await page.getByRole('button', { name: 'Launch mission' }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#menu')).toBeHidden();
  const altitude = Number(await page.locator('#altitude').textContent());
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await page.locator('#altitude').textContent()))
    .toBeGreaterThan(altitude + 3);
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await expect
    .poll(async () =>
      Number(
        await page
          .locator('#fuel-value')
          .textContent()
          .then((t) => t?.replace('%', '')),
      ),
    )
    .toBeLessThan(100);
  await page.keyboard.up('Space');
  await page.screenshot({ path: 'art/flight-screen.png' });
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.getByRole('button', { name: 'Resume flight' })).toBeVisible();
  const paused = await page.locator('#fuel-value').textContent();
  await page.waitForTimeout(250);
  expect(await page.locator('#fuel-value').textContent()).toBe(paused);
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Restart mission' }).click();
  await expect(page.locator('#score')).toHaveText('000000');
  await expect(page.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
});
test('briefing and settings return to a working launch screen', async ({ page }) => {
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.getByRole('button', { name: 'Instructions & controls' }).click();
  await expect(page.getByRole('heading', { name: 'Instructions & controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Ready to fly' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Reduced camera motion').check();
  await page.getByLabel('High quality shadows').uncheck();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Reduced camera motion')).toBeChecked();
  await expect(page.getByLabel('High quality shadows')).not.toBeChecked();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#launch').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#instructions-open').click();
  await expect(page.getByRole('heading', { name: 'Speed control — hold the key' })).toBeVisible();
  await page.locator('#briefing-close').click();
  await expect(page.locator('#pause-panel')).toBeVisible();
  await page.locator('#resume').click();
  await expect(page.locator('#overlay')).toBeHidden();
});
test('mobile launch and touch flight controls fit the screen', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.screenshot({ path: 'art/mobile-title.png' });
  await page.locator('#launch').tap();
  await expect(page.locator('#touch-controls')).toBeVisible();
  for (const id of ['stick', 'touch-fire', 'touch-missile', 'touch-boost']) {
    const box = await page.locator('#' + id).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: 'art/mobile-flight.png' });
  await context.close();
});

test('losing focus pauses safely and clears a held climb control', async ({ page }) => {
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').click();
  await page.keyboard.down('w');
  await expect
    .poll(async () => Number(await page.locator('#altitude').textContent()))
    .toBeGreaterThan(30);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('button', { name: 'Resume flight' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume flight' }).click();
  await expect
    .poll(() => page.evaluate(() => Math.abs((window as any).__delta.sim.player.pitch)))
    .toBeLessThan(0.01);
  await page.keyboard.up('w');
});

test('aircraft loss offers a usable checkpoint retry and restores the flight HUD', async ({
  page,
}) => {
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').click();
  await page.keyboard.down('s');
  await expect(page.getByRole('button', { name: 'Retry from checkpoint' })).toBeVisible({
    timeout: 10000,
  });
  await page.keyboard.up('s');
  await expect(page.locator('#result-description')).toContainText('Impact with the river');
  await page.getByRole('button', { name: 'Retry from checkpoint' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#health-value')).toHaveText('100%');
  await expect(page.locator('#missiles')).toHaveText('4');
  expect((await page.locator('#lives').textContent())?.trim()).toBe('▲ ▲');
});

test('arrow up pitches down and arrow down pitches up', async ({ page }) => {
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').click();
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => Number(await page.locator('#altitude').textContent()))
    .toBeLessThan(25);
  await page.keyboard.up('ArrowUp');
  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => Number(await page.locator('#altitude').textContent()))
    .toBeGreaterThan(29);
  await page.keyboard.up('ArrowDown');
});

test('long expedition saves at a bridge and can continue after reload', async ({ page }) => {
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').click();
  await page.evaluate(() => {
    const s = (window as any).__delta.sim;
    s.sector = 2;
    s.score = 3000;
    s.bridgeDestroyed = true;
    s.entities = [];
    s.player.pos = { x: 0, y: 85, z: -7199.9 };
    s.player.fuel = 58;
  });
  await expect(page.locator('#sector-code')).toHaveText('BRIDGE / 004');
  await page.reload();
  await expect(page.locator('#launch')).toBeEnabled();
  await page.getByRole('button', { name: 'Continue from bridge 4' }).click();
  await expect(page.locator('#sector-code')).toHaveText('BRIDGE / 004');
  await expect(page.locator('#score')).toHaveText('003500');
  expect(
    Number((await page.locator('#fuel-value').textContent())?.replace('%', '')),
  ).toBeLessThanOrEqual(58);
});

test('renders the split river and remains bounded while moving far upstream', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').click();
  await page.evaluate(() => {
    const s = (window as any).__delta.sim;
    s.player.pos = { x: 0, y: 64, z: -610 };
  });
  await expect(page.locator('#altitude')).not.toHaveText('28');
  await page.screenshot({ path: 'art/river-fork.png' });
  for (const sector of [20, 100, 300]) {
    await page.evaluate((sector) => {
      const s = (window as any).__delta.sim;
      s.sector = sector;
      s.player.pos = { x: 0, y: 85, z: -(sector * 2400 + 100) };
      s.player.fuel = 100;
      s.entities = [];
    }, sector);
    await expect(page.locator('#sector-code')).toHaveText(
      'BRIDGE / ' + String(sector + 1).padStart(3, '0'),
    );
    expect(await page.evaluate(() => (window as any).__delta.stats.chunks)).toBe(13);
  }
  expect(errors).toEqual([]);
});
