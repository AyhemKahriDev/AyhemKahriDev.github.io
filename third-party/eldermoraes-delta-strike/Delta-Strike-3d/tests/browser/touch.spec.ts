import { expect, test } from '@playwright/test';

test('touch briefing matches device and forward stick dives while backward climbs', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#instructions-open').click();
  await expect(page.getByRole('heading', { name: 'Fly with the touch stick' })).toBeVisible();
  await expect(page.locator('.keyboard-instructions')).toBeHidden();
  await page.locator('#briefing-close').click();
  await page.locator('#launch').click();
  await expect(page.locator('#stick')).toBeVisible();
  const box = (await page.locator('#stick').boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 35);
  await page.waitForFunction(() => (window as any).__delta.sim.player.pitch < -0.2);
  await page.mouse.up();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 35);
  await page.waitForFunction(() => (window as any).__delta.sim.player.pitch > 0.2);
  await page.mouse.up();
  await context.close();
});

test('holding fire and boost together does not select text or open a control menu', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/3d.html');
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').tap();
  await expect(page.locator('#touch-fire')).toBeVisible();
  const points = [];
  for (const [id, name] of ['touch-fire', 'touch-boost'].entries()) {
    const control = page.locator('#' + name);
    await expect(control).toHaveCSS('user-select', 'none');
    expect(
      await control.evaluate((e) =>
        e.dispatchEvent(new Event('contextmenu', { bubbles: true, cancelable: true })),
      ),
    ).toBe(false);
    const box = (await control.boundingBox())!;
    points.push({ id, x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  const touch = await context.newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await page.waitForFunction(() => {
    const s = (window as any).__delta.sim;
    return s.player.speed > 95 && s.bullets.some((b: any) => !b.enemy);
  });
  expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => (window as any).__delta.sim.player.speed < 75);
  await context.close();
});
