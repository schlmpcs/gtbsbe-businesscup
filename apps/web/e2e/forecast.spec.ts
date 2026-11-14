// S1 Today and S10 You in N years + Next Moves on the demo profile (phone + desktop projects).
import { expect, test, type Page } from '@playwright/test';
import { yearsPhrase } from '../src/copy/ai';
import { common } from '../src/copy/common';
import { forecast as t } from '../src/copy/forecast';
import { lifeEvents as le } from '../src/copy/lifeEvents';

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
  await expect(hero.getByRole('link', { name: f.start })).toHaveAttribute('href', '/me/guess');
  await expect(hero.getByTestId('play').getByRole('link', { name: f.play, exact: true })).toHaveAttribute('href', '/play');
  await expect(page.getByTestId('at-horizon')).toHaveCount(0); // no numbers on a first visit
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
  await noSideScroll(page);

  await hero.getByRole('link', { name: f.sample }).click();
  await expect(page).toHaveURL(/\/future$/); // ?sample=1 is dropped once the sample is loaded
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title(10));
  await expect(page.getByTestId('at-horizon')).toContainText(/\$\d/);
  const banner = page.getByTestId('sample-banner');
  await expect(banner).toContainText(common.sampleBanner.text);
  await noSideScroll(page);

  // The sample stays on across screens and reloads, until "Use mine".
  await page.reload();
  await expect(banner).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.today.home.title);
  await expect(banner).toBeVisible();
  await expect(page.getByTestId('nudge')).toHaveCount(0); // the banner already says it is the sample
  await banner.getByRole('link', { name: common.sampleBanner.cta }).click();
  await expect(page).toHaveURL(/\/me\/guess$/);
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
});

test('Home shows the house (10-year number with its range) and links to /play, /future and What if?', async ({ page }) => {
  // Past the first visit (the sample life is on), Home shows the numbers.
  await page.goto('/future?sample=1');
  await expect(page.getByTestId('sample-banner')).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.today.home.title);

  const atHorizon = page.getByTestId('at-horizon');
  await expect(atHorizon.getByRole('heading', { name: t.today.future.title(10) })).toBeVisible();
  await expect(atHorizon.getByText(t.netWorthAt(10))).toBeVisible();
  await expect(atHorizon.getByText(/^\$[\d,]+$/)).toBeVisible();
  await expect(atHorizon.getByText(/^Likely between \$[\d,]+ and \$[\d,]+$/)).toBeVisible();

  // No statements yet: the month-end card shows the projection only, and says why.
  await expect(page.getByTestId('month-end-no-history')).toContainText(t.today.monthEnd.needHistory(0));
  await noSideScroll(page);

  await expect(page.getByRole('region', { name: t.today.home.whatIf.title }).getByRole('link', { name: t.today.home.whatIf.all })).toHaveAttribute('href', '/tools');

  await page.getByTestId('play').getByRole('link', { name: t.today.playDuel.cta }).click();
  await expect(page).toHaveURL(/\/play$/);

  await page.goto('/');
  await page.getByRole('link', { name: t.today.home.openFuture }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title(10));
});

test('You in 10 years (the default) shows the chart with the labelled range band and 1–3 moves', async ({ page }) => {
  await page.goto('/future');
  const chart = page.getByRole('figure', { name: t.future.chartTitle(10) });
  await expect(chart.locator('.recharts-surface')).toBeVisible();
  await expect(chart.locator('.recharts-line-curve').first()).toBeVisible();
  await expect(chart.locator('.recharts-area-area').first()).toBeVisible();
  await expect(page.getByTestId('band-note')).toContainText(t.band.label);
  await expect(page.getByTestId('at-horizon')).toContainText(t.todaysDollarsNote);

  const moves = page.getByTestId('moves').getByRole('article');
  await expect(moves.first()).toBeVisible();
  const count = await moves.count();
  expect(count).toBeGreaterThanOrEqual(1);
  expect(count).toBeLessThanOrEqual(3);
  await expect(moves.first().getByText(/^\+\$[\d,]+$/)).toBeVisible();
  await expect(moves.first().getByText(t.moves.effectLabel(10))).toBeVisible();

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

test('picking 3 years re-reads the same forecast: the headline and the moves change, and nothing is asked of the forecast route', async ({ page }) => {
  const forecastRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/ai/forecast') forecastRequests.push(request.method());
  });

  await page.goto('/future');
  const headline = page.getByTestId('at-horizon');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title(10));
  await expect(headline.getByText(t.future.headline(10))).toBeVisible();
  // Let the first request settle (the model has up to ~25 s before the rules answer takes over), so the
  // requests counted below can only be ones the click caused. The source tag is no signal for that (the
  // rules answer shows at once); "Updating the forecast…" is on from the first render until the request
  // settles, so an empty one means the answer is in.
  await expect(page.getByTestId('forecast-refreshing')).toBeEmpty({ timeout: 30_000 });
  const asked = forecastRequests.length;
  expect(asked).toBeGreaterThan(0);

  // The headline number is the first amount in the block (the second one is today's).
  const amount = headline.getByText(/^−?\$[\d,]+$/).first();
  const atTen = (await amount.textContent()) ?? '';
  expect(atTen).toMatch(/\$/);
  const picker = page.getByRole('group', { name: t.future.horizonLabel });
  await expect(picker.getByRole('radio')).toHaveCount(4);
  await expect(page.getByRole('radio', { name: yearsPhrase(10) })).toBeChecked();

  await picker.getByText(yearsPhrase(3), { exact: true }).click();

  await expect(page.getByRole('radio', { name: yearsPhrase(3) })).toBeChecked();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title(3));
  await expect(headline.getByText(t.future.headline(3))).toBeVisible();
  await expect(amount).not.toHaveText(atTen);
  await expect(page.getByRole('figure', { name: t.future.chartTitle(3) })).toBeVisible();
  const first = page.getByTestId('moves').getByRole('article').first();
  await expect(first.getByText(t.moves.effectLabel(3))).toBeVisible();
  await expect(first).toContainText(`in ${yearsPhrase(3)}`);
  await expect(page.getByText(t.moves.intro(3))).toBeVisible();
  // A request for the new year would be debounced (it would go out after the assertions above), but the
  // screen would say it is updating at once: wait that out before counting. Already empty when correct.
  await expect(page.getByTestId('forecast-refreshing')).toBeEmpty({ timeout: 30_000 });
  expect(forecastRequests).toHaveLength(asked); // reading another year of the same answer is not a request
});

test('Today follows the year picked on You in N years, and the pick is remembered', async ({ page }) => {
  // Past the first visit (the sample life is on), so Today shows the forecast card; a fresh context
  // would otherwise open on the first-visit screen, which has no numbers.
  await page.goto('/future?sample=1');
  await expect(page.getByTestId('sample-banner')).toBeVisible();
  await expect(page.getByTestId('at-horizon').getByTestId('forecast-source')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('group', { name: t.future.horizonLabel }).getByText(yearsPhrase(5), { exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title(5));

  await page.reload();
  await expect(page.getByRole('radio', { name: yearsPhrase(5) })).toBeChecked();

  await page.goto('/');
  const card = page.getByTestId('at-horizon');
  await expect(card.getByRole('heading', { name: t.today.future.title(5) })).toBeVisible();
  await expect(card.getByText(t.netWorthAt(5))).toBeVisible();
});

test('Coming up: adding a kid from the shortcut moves the headline, and the event survives a reload', async ({ page }) => {
  // A fresh browser opens on the first-visit screen; the sample life puts numbers on S10.
  await page.goto('/future?sample=1');
  await expect(page).toHaveURL(/\/future$/);
  const headline = page.getByTestId('at-horizon');
  await expect(headline.getByText(t.future.headline(10))).toBeVisible();
  // Let the first forecast settle (the model may upgrade the rules number), so the number read below is final.
  await expect(page.getByTestId('forecast-refreshing')).toBeEmpty({ timeout: 30_000 });
  const amount = headline.getByText(/^−?\$[\d,]+$/).first();
  const before = (await amount.textContent()) ?? '';
  expect(before).toMatch(/\$/);

  const card = page.getByRole('region', { name: le.title });
  await expect(card.getByText(le.empty)).toBeVisible();
  await card.getByRole('button', { name: le.shortcuts.kid, exact: true }).click();
  const form = card.getByRole('form', { name: le.form.addTitle(le.shortcuts.kid) });
  await expect(form.getByText(le.form.kidHint.area)).toBeVisible(); // the sample's ZIP is one of our areas
  await form.getByRole('button', { name: le.form.add, exact: true }).click();

  const row = card.getByTestId('life-event');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(le.label({ kind: 'spending', preset: 'kid' }));
  // Childcare from next year on: the rules answer moves the number at once (the model's may follow).
  await expect(amount).not.toHaveText(before);
  await noSideScroll(page);

  await page.reload();
  await expect(page.getByRole('region', { name: le.title }).getByTestId('life-event')).toContainText(
    le.label({ kind: 'spending', preset: 'kid' }),
  );
  await expect(page.getByTestId('at-horizon').getByText(/^−?\$[\d,]+$/).first()).not.toHaveText(before);
});
