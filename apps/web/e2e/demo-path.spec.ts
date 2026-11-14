// T8: the 2-minute demo path (docs/PRODUCT.md → Two-minute demo script) in one spec, phone and
// desktop: play today's five duels at /play (a hint in the first) → the day result's "Price my own
// month" → guess your own month → closest life → sliders → You in 10 years → upload the sample
// statement → Loan Lab compare. Selectors come from the copy files and roles, so a Figma restyle or
// the duel moving to server routes (NEXT_PUBLIC_DUEL_SOURCE) does not break it. The slider game
// (NEXT_PUBLIC_GAME_MODE=slider, the rollback) has its own spec, play.spec.ts.
//
// When the build sends funnel events (NEXT_PUBLIC_EVENTS_SOURCE=api with a store, as CI's e2e job
// runs it), it also checks that each step of the path was recorded, that what was sent carries no
// personal data, and that GET /api/events/funnel counts it.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Request } from '@playwright/test';
import type { ClientFunnelEvent, FunnelReport } from '@lifeguessr/types';
import { common } from '../src/copy/common';
import { duel } from '../src/copy/duel';
import { forecast } from '../src/copy/forecast';
import { ladder } from '../src/copy/ladder';
import { loan } from '../src/copy/loan';

const SAMPLE_STATEMENT = fileURLToPath(new URL('../../../packages/data/fixtures/statement.sample.csv', import.meta.url));
const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_SOURCE === 'api';

/** The funnel steps this path goes through, in the order it reaches them. */
const PATH_EVENTS = [
  'play_started', 'hint_opened', 'duel_picked', 'own_guess_submitted', 'closest_life_chosen', 'sliders_adjusted',
  'forecast_viewed', 'statement_applied', 'loan_compared',
] as const satisfies readonly ClientFunnelEvent['name'][];

let pageErrors: string[] = [];
let sentEvents: (ClientFunnelEvent & { id: string })[] = [];
let eventRequests: Request[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  sentEvents = [];
  eventRequests = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
  page.on('request', (req) => {
    if (!req.url().endsWith('/api/events') || req.method() !== 'POST') return;
    eventRequests.push(req);
    sentEvents.push(...(req.postDataJSON() as { events: (ClientFunnelEvent & { id: string })[] }).events);
  });
  page.on('response', (res) => {
    if (res.url().endsWith('/api/events') && res.status() !== 200) pageErrors.push(`POST /api/events → ${res.status()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

async function expectNoSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

/**
 * Resolves when a batch with this event has been stored (200). Start it before the action and
 * await it before leaving the page: an event sent on pagehide (keepalive) does reach the server,
 * but Playwright does not reliably report requests from a document that is unloading. With events
 * off it resolves at once.
 */
function stored(page: Page, name: ClientFunnelEvent['name']): Promise<unknown> {
  if (!EVENTS_ON) return Promise.resolve();
  return page.waitForResponse(
    (res) => res.url().endsWith('/api/events') && res.status() === 200 && (res.request().postData() ?? '').includes(`"name":"${name}"`),
    { timeout: 10_000 },
  );
}

test('demo path: 5 duels → own guess → sliders → forecast → statement → Loan Lab', async ({ page }) => {
  test.setTimeout(120_000);

  // ----- 1. Play today's five duels at /play (S2 → S3 → day result) -----
  await page.goto('/play');
  await expect(h1(page)).toHaveText(duel.title);
  // One hint in the first round: one more fact on each card, for −10% of the round's points.
  await page.getByRole('button', { name: duel.hint.offer('10%') }).click();
  await expect(page.getByText(duel.hint.used('900'))).toBeVisible();
  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(duel.round(round, 5))).toBeVisible();
    await page.getByRole('button', { name: /^Life A costs more/ }).click();
    // The reveal: both monthly totals, each with its category breakdown, computed by the engine.
    await expect(page.getByText(/^Right! \+[\d,]+ points$|^Not this time · 0 points$/)).toBeVisible();
    for (const letter of ['A', 'B'] as const) {
      const breakdown = page.getByRole('list', { name: duel.reveal.breakdownLabel(letter) });
      await expect(breakdown).toBeVisible();
      await expect(page.getByRole('article').filter({ has: breakdown }).getByText(/\$[\d,]+/).first()).toBeVisible();
    }
    await page.getByRole('button', { name: round === 5 ? duel.reveal.finish : duel.reveal.next }).click();
  }
  await expect(page.getByRole('heading', { name: duel.summary.heading })).toBeVisible();
  await expect(page.getByRole('list', { name: duel.summary.gridLabel }).getByRole('listitem')).toHaveCount(5);
  await expectNoSideScroll(page);
  // The game's events leave in their own batch before the next page (see `stored`).
  if (EVENTS_ON) await expect.poll(() => sentEvents.filter((e) => e.name === 'duel_picked').length, { timeout: 10_000 }).toBe(5);
  await page.getByRole('link', { name: duel.summary.cta }).click();
  await expect(page).toHaveURL(/\/me\/guess$/);

  // ----- 2. Guess your own month (S5) -----
  await expect(h1(page)).toHaveText(ladder.screens.S5);
  const own = page.getByRole('slider', { name: ladder.guess.sliderLabel });
  await own.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  const ownGuess = stored(page, 'own_guess_submitted');
  await page.getByRole('button', { name: ladder.guess.submit }).click();
  await expect(page.getByRole('region', { name: ladder.guess.compareTitle })).toBeVisible();
  await expect(page.getByTestId('guess-verdict')).not.toBeEmpty();

  await ownGuess;

  // ----- 3. Closest life (S6), from the sample lives (the duel's lives are composites) -----
  await page.getByRole('link', { name: ladder.shell.cta.S5 }).click();
  await expect(page).toHaveURL(/\/me\/closest$/);
  const choose = page.getByRole('button', { name: new RegExp(`^${ladder.closest.choose}`) }).first();
  const chosen = stored(page, 'closest_life_chosen');
  await choose.click();
  await expect(choose).toHaveAttribute('aria-pressed', 'true');
  await chosen;

  // ----- 4. Sliders (S7): the month and the 10-year number follow -----
  await page.getByRole('link', { name: ladder.shell.cta.S6 }).click();
  await expect(page).toHaveURL(/\/me\/sliders$/);
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  const monthCost = page.getByTestId('month-cost');
  const costBefore = await monthCost.textContent();
  const adjusted = stored(page, 'sliders_adjusted');
  await eatingOut.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(monthCost).not.toHaveText(costBefore ?? '');
  await adjusted;
  await expectNoSideScroll(page);

  // ----- 5. You in 10 years (S10), through the step CTAs: S7 → S8 → S9 → the forecast -----
  await page.getByRole('link', { name: ladder.shell.cta.S7 }).click();
  await expect(page).toHaveURL(/\/me\/balance$/);
  await page.getByRole('link', { name: ladder.shell.cta.S8 }).click();
  await expect(page).toHaveURL(/\/me\/upload$/);
  const viewed = stored(page, 'forecast_viewed');
  await page.getByRole('link', { name: ladder.shell.cta.S9 }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(h1(page)).toHaveText(forecast.future.title(10));
  const chart = page.getByRole('figure', { name: forecast.future.chartTitle(10) });
  await expect(chart.locator('.recharts-line-curve').first()).toBeVisible();
  await expect(chart.locator('.recharts-area-area').first()).toBeVisible();
  await expect(page.getByTestId('at-horizon').getByText(/^Likely between −?\$[\d,]+ and −?\$[\d,]+$/)).toBeVisible();
  await expect(page.getByTestId('moves').getByRole('article').first()).toBeVisible();
  await viewed;

  // ----- 6. Upload the sample statement (S9): estimates become measured, the step is done -----
  await page.goto('/me/upload');
  await expect(page.locator('[data-rung="S9"]')).toHaveAttribute('data-done', 'false');
  await page.getByLabel(ladder.upload.pickerLabel).setInputFiles(SAMPLE_STATEMENT);
  await expect(page.getByRole('region', { name: ladder.upload.monthLabel('2026-10') })).toBeVisible();
  const applied = stored(page, 'statement_applied');
  await page.getByRole('button', { name: ladder.upload.apply }).click();
  await expect(page.getByText(ladder.upload.applied)).toBeVisible();
  await expect(page.locator('[data-rung="S9"]')).toHaveAttribute('data-done', 'true');
  await applied;

  // ----- 7. Loan Lab (S12): three offers side by side, the debt-load gauge, pick another -----
  await page.goto('/loan');
  const table = page.getByRole('table', { name: loan.compare.caption });
  await expect(table).toBeVisible();
  for (const n of [1, 2, 3]) await expect(table.getByRole('button', { name: loan.compare.select(loan.offerName(n)) })).toBeVisible();
  const second = table.getByRole('button', { name: loan.compare.select(loan.offerName(2)) });
  await second.click();
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('meter')).toHaveCount(2);
  await expectNoSideScroll(page);

  // ----- Funnel events -----
  if (!EVENTS_ON) return;
  // The last batch leaves about a second after the last step (or when the page is closed).
  await expect
    .poll(() => PATH_EVENTS.filter((name) => !sentEvents.some((e) => e.name === name)), { timeout: 15_000 })
    .toEqual([]);
  // The duel reports its hint and each round it picked (useDuel).
  const hints = sentEvents.filter((e) => e.name === 'hint_opened');
  expect(hints.map((e) => (e as Extract<ClientFunnelEvent, { name: 'hint_opened' }>).props)).toEqual([{ round: 1 }]);
  const picked = sentEvents.filter((e) => e.name === 'duel_picked');
  expect(picked.map((e) => (e as Extract<ClientFunnelEvent, { name: 'duel_picked' }>).props.round)).toEqual([1, 2, 3, 4, 5]);

  // Nothing personal leaves the browser: the id travels in a header and the body, never the URL,
  // and no event carries statement text.
  const anonId = await page.evaluate(() => localStorage.getItem('lifeguessr.anonId'));
  expect(anonId).toMatch(/^[0-9a-f-]{36}$/);
  for (const req of eventRequests) {
    expect(req.url()).not.toContain(anonId!);
    expect(req.headers()['x-anon-id']).toBe(anonId);
    expect(req.postData() ?? '').not.toMatch(/Tom Becker|Maria Lopez|Daniel Kim|PRIYA SHAH|Jake Morris|Zelle|Venmo/i);
  }

  // The funnel counts this run (the store is shared with the other specs, so at least 1).
  await expect
    .poll(async () => {
      const res = await page.request.get('/api/events/funnel?days=1');
      expect(res.status()).toBe(200);
      const report = (await res.json()) as FunnelReport;
      return PATH_EVENTS.filter((name) => report.events[name] < 1);
    })
    .toEqual([]);
});
