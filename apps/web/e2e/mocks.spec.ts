// S13 Decision (keep the car or lease) and S14 Monthly check-in on the demo profile and fixtures,
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
const c = mocks.checkin;

test.describe('S13 Decision: keep the car or lease', () => {
  test('shows both paths and the result; editing the lease changes it', async ({ page }) => {
    await page.goto('/decide');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.title);
    await expect(page.getByRole('region', { name: d.keep.title })).toBeVisible();
    await expect(page.getByRole('region', { name: d.lease.title })).toBeVisible();
    const score = page.getByLabel(d.scoreLabel);
    await expect(score).toBeVisible();
    const before = await score.textContent();

    await page.getByTestId('lease-edit-disclosure-summary').click(); // JF14: the lease terms are behind a disclosure
    await page.getByRole('textbox', { name: new RegExp(`^${d.edit.monthly}`) }).fill('150');
    await expect(score).not.toHaveText(before ?? '');
    await expectNoHorizontalScroll(page);
  });
});

test.describe('S14 Monthly check-in', () => {
  test('reviews the sample month, commits to a move and marks it done', async ({ page }) => {
    await page.goto('/checkin');
    await expect(page.getByText(c.eyebrow('October'))).toBeVisible();
    await expect(page.getByText(c.sampleNote)).toBeVisible();
    await expect(page.getByLabel(c.scoreLabelDone)).toBeVisible();
    await expect(page.getByRole('heading', { name: c.driftTitle })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const move = page.getByTestId('checkin-move');
    await move.getByRole('button', { name: new RegExp(`^${c.move.commit}`) }).first().click();
    await expect(move.getByText(c.move.question)).toBeVisible();
    await move.getByRole('button', { name: c.move.done }).click();
    await expect(page.getByTestId('checkin-move')).toContainText(c.move.doneTitle);
    await expect(page.getByRole('link', { name: new RegExp(c.addStatement('November')) })).toHaveAttribute('href', '/me/upload');
    await expectNoHorizontalScroll(page);
  });
});
