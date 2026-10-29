import { expect, test } from '@playwright/test';

test('shared entrance launches both editions and provides a return path', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose your airspace.');
  await expect(page.locator('.scene img')).toHaveCount(2);
  expect(
    await page
      .locator('.scene img')
      .evaluateAll((images) =>
        images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
      ),
  ).toBe(true);
  await page.getByRole('link', { name: /Play in 2D/ }).click();
  await expect(page).toHaveURL(/classic\.html$/);
  await page.waitForFunction(() => (window as any).DS?.Game?.state === 'title');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as any).DS.Game.state === 'playing');
  await page.getByRole('link', { name: 'Back to edition selection' }).click();
  await page.getByRole('link', { name: /Play in 3D/ }).click();
  await expect(page).toHaveURL(/3d\.html$/);
  await expect(page.locator('#launch')).toBeEnabled();
  await page.locator('#launch').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.getByRole('link', { name: 'Back to edition selection' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choose your airspace.');
  expect(errors).toEqual([]);
});

test('selection fits mobile and supports keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Play in 2D/ })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /Play in 3D/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#launch')).toBeEnabled();
});
