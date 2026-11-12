import { test, expect } from '@playwright/test';

test('syllabus → topic notes → learn-mode practice records an attempt', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/syllabus/quant');
  await expect(page.getByRole('heading', { name: 'Syllabus' })).toBeVisible();
  await page.getByRole('link', { name: /Percentage/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Percentage' })).toBeVisible();
  await page.getByRole('link', { name: 'Practice', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.locator('.opt').first().click();
  await expect(page.locator('.solution')).toBeVisible();
  await page.goto('/#/analysis');
  await expect(page.getByText('Mock scores')).toBeVisible();
  expect(errors).toEqual([]);
});

test('daily Tier 1 mock: start, answer, submit section, see result', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/mocks');
  await page.locator('.ticket').filter({ hasText: 'Tier 1' }).first().getByRole('button', { name: /Start|Resume/ }).click();
  await page.getByRole('button', { name: 'I am ready to begin' }).click();
  await expect(page.locator('.exam-bar .timer')).toBeVisible();
  for (let s = 0; s < 4; s++) {
    await page.locator('.opt').first().click();
    await page.getByRole('button', { name: 'Save & next' }).click();
    const pal = page.locator('.pal-toggle').first();
    if (await pal.isVisible()) await pal.click();
    await page.locator('.palette .btn.danger').click();
    await page.locator('dialog .btn.primary').click();
  }
  await expect(page.getByRole('heading', { name: 'Review answers' })).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('flashcards and settings render', async ({ page }) => {
  await page.goto('/#/revise');
  await expect(page.getByRole('heading', { name: 'Revise' })).toBeVisible();
  await page.goto('/#/settings');
  await expect(page.getByRole('button', { name: 'Download backup' })).toBeVisible();
});

test('formula sheets and study plan', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/formulas');
  await expect(page.getByRole('heading', { name: 'Formula sheets' })).toBeVisible();
  await page.getByRole('link', { name: 'Squares 1–50' }).click();
  await expect(page.getByText('2500')).toBeVisible();
  await page.goto('/#/formulas/q-percentage');
  await expect(page.locator('.formula').first()).toBeVisible();
  await page.goto('/#/settings');
  await page.locator('input[type=date]').fill('2027-03-01');
  await page.locator('input[type=date]').dispatchEvent('change');
  await page.goto('/#/plan');
  await expect(page.getByRole('heading', { name: 'Study plan' })).toBeVisible();
  await expect(page.getByText('This week').first()).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();
  expect(errors).toEqual([]);
});
