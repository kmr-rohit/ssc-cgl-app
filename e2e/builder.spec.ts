import { test, expect, type Page } from '@playwright/test';

const begin = async (page: Page) => {
  await page.getByRole('button', { name: 'I am ready to begin' }).click();
  await expect(page.locator('.exam-bar')).toBeVisible();
};

test('preset: Advanced Maths sprint builds a 20-question Maths-only test on chosen topics', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/#/mocks');
  await page.getByRole('link', { name: 'Build a test' }).click();
  await page.getByRole('button', { name: /Advanced Maths sprint/ }).click();
  await expect(page.getByRole('region', { name: 'Summary' })).toContainText('20 questions');
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByRole('heading', { name: 'Advanced Maths sprint' })).toBeVisible({ timeout: 20_000 });
  await begin(page);
  const ids: string[] = await page.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('cglprep-mocks');
    r.onsuccess = () => { const all = r.result.transaction('kv').objectStore('kv').getAll(); all.onsuccess = () => res(all.result.find((m: { title?: string }) => m.title === 'Advanced Maths sprint').sections.flatMap((s: { questionIds: string[] }) => s.questionIds)); };
  }));
  expect(ids).toHaveLength(20);
  // a past-paper id keeps the topic it was first filed under; the manifest maps questions moved to a corrected topic
  const moved: Record<string, string> = await page.evaluate(async () => {
    const m = await (await fetch('/pyq/manifest.json')).json();
    return Object.fromEntries(Object.entries(m.moved ?? {}).flatMap(([t, xs]) => (xs as string[]).map((x) => [x, t])));
  });
  for (const id of ids) expect(moved[id] ?? id).toMatch(/q-(algebra|geometry|mensuration|trigonometry)/);
  expect(errors).toEqual([]);
});

test('Second chance: only my mistakes, answer shown right after choosing, no timer', async ({ page }) => {
  // make some mistakes (wrong answers; skips don't count): answer A to learn-mode questions until one is wrong
  await page.goto('/#/topic/q-percentage/practice');
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'Start practice' }).click();
  let wrong = 0;
  for (let i = 0; i < 10 && wrong < 2; i++) {
    await page.locator('.opt').first().click();
    await expect(page.locator('.solution')).toBeVisible();
    if (await page.locator('.opt.wrong').count()) wrong++;
    const next = page.getByRole('button', { name: 'Next' });
    if (await next.count()) await next.click(); else break;
  }
  expect(wrong).toBeGreaterThan(0);

  await page.goto('/#/build');
  await page.getByRole('button', { name: /Second chance/ }).click();
  await page.getByRole('button', { name: 'Start test' }).click();
  await expect(page.getByText('Your first choice is final')).toBeVisible({ timeout: 20_000 });
  await begin(page);
  await expect(page.locator('.timer')).toContainText('used');
  await page.locator('.opt').first().click();
  await expect(page.locator('.solution')).toBeVisible();          // instant answer
  await expect(page.locator('.opt').first()).toBeDisabled();      // first choice is final
});

test('save a setup as my test and start it from Mocks', async ({ page }) => {
  await page.goto('/#/build');
  await page.getByRole('button', { name: /10-minute mini/ }).click();
  await page.getByLabel('Name (optional)').fill('Morning warm-up');
  await page.getByLabel('Name (optional)').press('Tab');
  await page.getByRole('button', { name: 'Save as my test' }).click();
  await page.goto('/#/mocks');
  const row = page.locator('.spread', { hasText: 'Morning warm-up' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Morning warm-up' })).toBeVisible({ timeout: 20_000 });
});

test('challenge: result offers it (sign-in first) and a challenge link explains what to do', async ({ page }) => {
  await page.goto('/#/build');
  await page.getByRole('button', { name: /10-minute mini/ }).click();
  await page.getByRole('button', { name: 'Start test' }).click();
  await page.getByRole('button', { name: 'I am ready to begin' }).click({ timeout: 20_000 });
  await page.locator('.opt').first().click();
  for (let s = 0; s < 4; s++) {
    const pal = page.locator('.pal-toggle').first();
    if (await pal.isVisible()) await pal.click();
    await page.locator('.palette .btn.danger').click();
    await page.locator('dialog .btn.primary').click();
  }
  await expect(page.getByRole('heading', { name: 'Challenge a friend' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Sign in to challenge' })).toBeVisible();

  await page.goto('/#/c/K7PQ2M');
  await expect(page.getByRole('heading', { name: 'A friend has challenged you' })).toBeVisible();
  await page.goto('/#/c/bad');
  await expect(page.getByRole('heading', { name: "That code doesn't look right" })).toBeVisible();
});
