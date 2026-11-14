// Design previews of not-yet-built screens (/preview/*): each route renders the sample banner and
// its main heading, with no page errors and no sideways scroll, on phone and desktop.
import { expect, test } from '@playwright/test';
import { previewA as t } from '../src/copy/previewA';

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

const ROUTES = [
  { path: '/preview/checkin', heading: t.checkin.title },
  { path: '/preview/pro-manage', heading: t.manage.title },
  { path: '/preview/calendar', heading: t.calendar.title },
  { path: '/preview/shared-decision', heading: t.shared.title },
  { path: '/preview/leaderboard', heading: t.leaderboard.title },
];

for (const { path, heading } of ROUTES) {
  test(`${path} shows the preview banner and its heading`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByTestId('preview-banner')).toHaveText(t.banner.text);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

test('check-in: fast-forward shows a simulated month', async ({ page }) => {
  await page.goto('/preview/checkin');
  await page.getByRole('button', { name: t.checkin.fastForward }).click();
  await expect(page.getByTestId('simulated-month')).toContainText(t.checkin.simulatedTag);
  await expect(page.getByTestId('checkin-compare')).toBeVisible();
});

test('manage Pro: cancel opens the value check with two equal choices', async ({ page }) => {
  await page.goto('/preview/pro-manage');
  await page.getByRole('button', { name: t.manage.cancel }).click();
  const dialog = page.getByRole('dialog', { name: t.manage.modalTitle });
  await expect(dialog.getByTestId('pro-value-check')).toBeVisible();
  const pause = await dialog.getByRole('button', { name: t.manage.pauseInstead }).boundingBox();
  const cancel = await dialog.getByRole('button', { name: t.manage.confirmCancel }).boundingBox();
  expect(Math.round(pause!.width)).toBe(Math.round(cancel!.width));
  expect(Math.round(pause!.height)).toBe(Math.round(cancel!.height));
});
