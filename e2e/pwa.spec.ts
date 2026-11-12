// Installable web app checks against the production build (service worker only runs there).
import { test, expect, devices } from '@playwright/test';

test('manifest and icons are valid for Android and iOS', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
  }
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(apple!)).status()).toBe(200);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('works offline after the first visit, including screens never opened', async ({ page, context }) => {
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); // setup saved, Today + tour shown
  await page.keyboard.press('Escape');
  // wait until the service worker has finished installing (precache complete) and controls the page
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated' && !!navigator.serviceWorker.controller, null, { timeout: 30_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: "Today's plan" })).toBeVisible();
  await page.goto('/#/mocks');
  await expect(page.getByRole('heading', { name: 'Mocks' })).toBeVisible();
  await page.goto('/#/formulas/squares');
  await expect(page.getByText('2500')).toBeVisible();
  await page.goto('/#/topic/q-geometry/learn');
  await expect(page.getByRole('heading', { name: 'Geometry' })).toBeVisible();
  await expect(page.locator('img.fig').first()).toBeVisible(); // SVG figure from the precache
  await context.setOffline(false);
});

test.describe('iPhone', () => {
  const { defaultBrowserType: _ignored, ...iphone } = devices['iPhone 13'];
  test.use(iphone);
  test('shows Add to Home Screen steps on Today and in Profile', async ({ page }) => {
    await page.goto('/#/welcome');
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    const banner = page.getByRole('region', { name: 'Install the app' });
    await expect(banner).toContainText('Add to Home Screen');
    await page.goto('/#/profile');
    await expect(page.getByRole('heading', { name: 'Install the app' })).toBeVisible();
    await expect(page.locator('.install-steps').first()).toContainText('Share');
    await page.goto('/#/');
    await banner.getByRole('button', { name: 'Dismiss' }).click();
    await expect(banner).toHaveCount(0);
  });
});
