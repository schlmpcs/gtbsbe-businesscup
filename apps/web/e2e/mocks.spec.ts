// S13 Decision (keep the car or lease) on the demo profile and fixtures (S14 is checkin.spec.ts),
// phone + desktop.
import { expect, test, type Page } from '@playwright/test';
import { mocks } from '../src/copy/mocks';

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

const d = mocks.decide;

test.describe('S13 Decision: keep the car or lease', () => {
  test('shows both paths and the result; editing the lease changes it', async ({ page }) => {
    await page.goto('/decide');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.title);
    await expect(page.getByRole('region', { name: d.keep.title })).toBeVisible();
    await expect(page.getByRole('region', { name: d.lease.title })).toBeVisible();
    const score = page.getByLabel(d.scoreLabel);
    await expect(score).toBeVisible();
    const before = await score.textContent();

    await page.getByRole('textbox', { name: new RegExp(`^${d.edit.monthly}`) }).fill('150');
    await expect(score).not.toHaveText(before ?? '');
    await expectNoHorizontalScroll(page);
  });
});

