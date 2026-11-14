// S1 Today and S10 You in 10 years + Next Moves on the demo profile (phone + desktop projects).
import { expect, test, type Page } from '@playwright/test';
import { common } from '../src/copy/common';
import { forecast as t } from '../src/copy/forecast';

let pageErrors: string[] = [];

// Errors are collected only on this spec's screens; /play and /me/guess are other features' (only navigated to).
const OWN_PATHS = new Set(['/', '/future']);
const onOwnScreen = (page: Page) => OWN_PATHS.has(new URL(page.url()).pathname);

test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => {
    if (onOwnScreen(page)) pageErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error' && onOwnScreen(page)) pageErrors.push(`console.error: ${msg.text()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

async function noSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('first visit: Today explains the app; Try with sample data opens the forecast with the sample banner', async ({ page }) => {
  const f = t.today.firstVisit;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(f.title);
  await expect(page.getByText(f.body)).toBeVisible();
  await expect(page.getByText(f.note)).toBeVisible();
  const hero = page.getByTestId('today-first-visit');
  await expect(hero.getByRole('link', { name: f.play, exact: true })).toHaveAttribute('href', '/play');
  await expect(page.getByTestId('in10y')).toHaveCount(0); // no numbers on a first visit
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
  await noSideScroll(page);

  await hero.getByRole('link', { name: f.sample }).click();
  await expect(page).toHaveURL(/\/future$/); // ?sample=1 is dropped once the sample is loaded
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title);
  await expect(page.getByTestId('in10y')).toContainText(/\$\d/);
  const banner = page.getByTestId('sample-banner');
  await expect(banner).toContainText(common.sampleBanner.text);
  await noSideScroll(page);

  // The sample stays on across screens and reloads, until "Use mine".
  await page.reload();
  await expect(banner).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.today.duel.title);
  await expect(banner).toBeVisible();
  await banner.getByRole('link', { name: common.sampleBanner.cta }).click();
  await expect(page).toHaveURL(/\/me\/guess$/);
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
});

test('Today shows the 10-year number with its range and links to /play and /future', async ({ page }) => {
  // Past the first visit (the sample life is on), Today shows the numbers.
  await page.goto('/future?sample=1');
  await expect(page.getByTestId('sample-banner')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.today.duel.title);

  const in10y = page.getByTestId('in10y');
  await expect(in10y.getByText(t.netWorthIn10y)).toBeVisible();
  await expect(in10y.getByText(/^\$[\d,]+$/)).toBeVisible();
  await expect(in10y.getByText(/^Likely between \$[\d,]+ and \$[\d,]+$/)).toBeVisible();

  // No statements yet: the month-end card shows the projection only, and says why.
  await expect(page.getByTestId('month-end-no-history')).toContainText(t.today.monthEnd.needHistory(0));
  await noSideScroll(page);

  await page.getByRole('link', { name: t.today.playDuel.cta }).click();
  await expect(page).toHaveURL(/\/play$/);

  await page.goto('/');
  await page.getByRole('link', { name: t.today.future.cta }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title);
});

test('You in 10 years shows the chart with the labelled range band and 1–3 moves', async ({ page }) => {
  await page.goto('/future');
  const chart = page.getByRole('figure', { name: t.future.chartTitle });
  await expect(chart.locator('.recharts-surface')).toBeVisible();
  await expect(chart.locator('.recharts-line-curve').first()).toBeVisible();
  await expect(chart.locator('.recharts-area-area').first()).toBeVisible();
  await expect(page.getByTestId('band-note')).toContainText(t.band.label);
  await expect(page.getByTestId('in10y')).toContainText(t.todaysDollarsNote);

  const moves = page.getByTestId('moves').getByRole('article');
  await expect(moves.first()).toBeVisible();
  const count = await moves.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);
  await expect(moves.first().getByText(/^\+\$[\d,]+$/)).toBeVisible();

  // Compare with the top move: a second line appears.
  await page.getByRole('checkbox', { name: /^Compare with:/ }).check();
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2);

  // How we calculate lists sourced numbers and our assumptions.
  const how = page.getByTestId('how-we-calculate');
  await how.locator('summary').click();
  await expect(how.getByText(t.how.labels.cardAprDefault)).toBeVisible();
  await expect(how.getByText(t.how.assumption).first()).toBeVisible();
  await noSideScroll(page);
});

test('committing a move flags it and survives a reload', async ({ page }) => {
  await page.goto('/future');
  const first = page.getByTestId('moves').getByRole('article').first();
  await expect(first).toBeVisible();
  const id = await first.getAttribute('data-move-id');
  expect(id).toBeTruthy();

  await first.getByRole('button', { name: t.moves.commit }).click();
  const committed = page.locator(`[data-move-id="${id}"]`);
  await expect(committed).toHaveAttribute('data-committed', 'true');
  await expect(committed.getByTestId('committed-badge')).toHaveText(t.moves.committed);
  await expect(page.getByTestId('level-2')).toHaveAttribute('data-locked', 'false');

  await page.reload();
  await expect(page.locator(`[data-move-id="${id}"]`)).toHaveAttribute('data-committed', 'true');
  await expect(page.locator(`[data-move-id="${id}"]`).getByTestId('committed-badge')).toBeVisible();

  // Today shows it as your move.
  await page.goto('/');
  await expect(page.getByTestId('today-move')).toContainText(t.today.move.committedTitle);
});
