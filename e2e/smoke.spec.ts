import { test, expect } from '@playwright/test';

test('syllabus → topic notes → learn-mode practice records an attempt', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/syllabus/quant');
  await expect(page.getByRole('heading', { name: 'Study', exact: true })).toBeVisible();
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
  await page.goto('/#/roadmap');
  await expect(page.getByRole('heading', { name: 'Roadmap', exact: true })).toBeVisible();
  await expect(page.getByText('This week').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('exam mode counts leaving the tab and shows it in the result', async ({ page }) => {
  await page.goto('/#/mocks');
  await page.locator('.ticket').filter({ hasText: 'Tier 1' }).first().getByRole('button', { name: /Start|Resume/ }).click();
  await page.getByRole('button', { name: 'I am ready to begin' }).click();
  await expect(page.locator('.exam-bar')).toBeVisible();
  // simulate switching away and back
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('.exam-warning')).toContainText('You left the test (1 time)');
  await page.locator('.exam-warning').getByRole('button', { name: 'Continue' }).click();
  for (let s = 0; s < 4; s++) {
    const pal = page.locator('.pal-toggle').first();
    if (await pal.isVisible()) await pal.click();
    await page.locator('.palette .btn.danger').click();
    await page.locator('dialog .btn.primary').click();
  }
  await expect(page.getByText(/left the test 1 time/)).toBeVisible({ timeout: 15_000 });
});

test('account screen offers Google and email sign-in (no network calls made)', async ({ page }) => {
  await page.goto('/#/account');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await page.getByLabel('Email').fill('someone@gmail.com');
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeEnabled();
  await page.goto('/#/settings');
  await expect(page.getByText('Sign in to sync your progress across devices')).toBeVisible();
});

test('first run: setup builds the roadmap, then Today shows a task checklist', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: "Let's build your roadmap" })).toBeVisible();
  await page.getByRole('button', { name: /Tier 2/ }).click();
  await page.getByRole('button', { name: 'In 6 months' }).click();
  await page.getByRole('button', { name: '4h' }).click();
  await page.getByRole('button', { name: 'Create my roadmap' }).click();
  // guided tour: 8 steps, each spotlighting a tab
  const tour = page.getByRole('dialog');
  await expect(tour).toContainText('Your roadmap is ready');
  await tour.getByRole('button', { name: 'Show me' }).click();
  for (const name of ['Today', 'Roadmap', 'Study', 'Mocks', 'Progress', 'Profile']) {
    await expect(tour.getByRole('heading')).toHaveText(name);
    await expect(page.locator('.tour-spot')).toBeVisible();
    await tour.getByRole('button', { name: 'Next' }).click();
  }
  await tour.getByRole('button', { name: "Let's start" }).click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Next up' })).toBeVisible();
  // tour doesn't come back; roadmap reflects setup
  await page.reload();
  await expect(page.getByRole('region', { name: 'Next up' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#/roadmap');
  await expect(page.getByText('Tier 2 Paper 1 (Mains)')).toBeVisible();
  await page.goto('/#/');
  await expect(page.locator('.countdown b')).toHaveText(/\d+/);
  await expect(page.getByRole('region', { name: 'Next up' })).toContainText('Learn & practise');
  await expect(page.getByRole('button', { name: 'Read the notes' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('bottom tabs: Today, Roadmap, Study, Mocks, Progress', async ({ page }) => {
  await page.goto('/#/study');
  const nav = page.locator(page.viewportSize()!.width <= 760 ? '#tabbar' : '#rail-nav');
  await expect(nav.getByRole('link')).toHaveText(['Today', 'Roadmap', 'Study', 'Mocks', 'Progress']);
  await nav.getByRole('link', { name: 'Roadmap' }).click();
  await expect(page.getByRole('heading', { name: 'Roadmap', exact: true })).toBeVisible();
});

test('skipped questions land in My mistakes and can be retried', async ({ page }) => {
  await page.goto('/#/topic/q-percentage/practice');
  await page.getByRole('button', { name: 'Test (timed)' }).click();
  await page.getByRole('button', { name: '5', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.goto('/#/mistakes');
  await expect(page.getByText(/5 questions to fix/)).toBeVisible();
  await page.getByRole('button', { name: /Retry 5 now/ }).click();
  await expect(page.locator('.opt').first()).toBeVisible();
});

test('phone: top bar shows the topic title and Back returns', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 760, 'top bar is mobile-only');
  await page.goto('/#/study');
  await page.getByRole('link', { name: /Percentage/ }).first().click();
  await expect(page.locator('.topbar .tb-title')).toHaveText('Percentage');
  await page.locator('.topbar .tb-back').click();
  await expect(page.getByRole('heading', { name: 'Study', exact: true })).toBeVisible();
  await page.locator('.topbar .tb-avatar').click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
});

test('tour can be skipped with Escape and replayed from Profile', async ({ page }) => {
  await page.goto('/#/welcome');
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/#/profile');
  await page.getByRole('button', { name: 'Take the app tour' }).click();
  await expect(page.getByRole('dialog')).toContainText('Your roadmap is ready');
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
