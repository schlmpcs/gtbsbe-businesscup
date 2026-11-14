// T8: the 2-minute demo path (docs/PRODUCT.md → Two-minute demo script) in one spec, phone and
// desktop: play 3 homes, opening a room in each → guess your own month → closest life → sliders →
// You in 10 years → upload the sample statement → Loan Lab compare. Selectors come from the copy
// files and roles, so a Figma restyle or the game moving to server routes (NEXT_PUBLIC_GAME_SOURCE)
// does not break it.
//
// When the build sends funnel events (NEXT_PUBLIC_EVENTS_SOURCE=api with a store, as CI's e2e job
// runs it), it also checks that each step of the path was recorded, that what was sent carries no
// personal data, and that GET /api/events/funnel counts it.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Request } from '@playwright/test';
import type { ClientFunnelEvent, FunnelReport } from '@lifeguessr/types';
import { common } from '../src/copy/common';
import { forecast } from '../src/copy/forecast';
import { game } from '../src/copy/game';
import { ladder } from '../src/copy/ladder';
import { loan } from '../src/copy/loan';

const SAMPLE_STATEMENT = fileURLToPath(new URL('../../../packages/data/fixtures/statement.sample.csv', import.meta.url));
const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_SOURCE === 'api';

/** The funnel steps this path goes through, in the order it reaches them. */
const PATH_EVENTS = [
  'play_started', 'clue_opened', 'home_guessed', 'own_guess_submitted', 'closest_life_chosen', 'sliders_adjusted',
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

test('demo path: 3 homes → own guess → sliders → forecast → statement → Loan Lab', async ({ page, isMobile }) => {
  test.setTimeout(120_000);

  // ----- 1. Play 3 homes, opening one room in each (S2 → S3) -----
  await page.goto('/play');
  await expect(h1(page)).toHaveText(game.screens.S2);
  const rooms = [game.clues.rooms.kitchen, game.clues.rooms.garage, game.clues.rooms.mailbox] as const;
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(game.progress(i + 1, 5))).toBeVisible();
    await page.getByRole('button', { name: rooms[i], exact: true }).click();
    const closeUp = page.getByRole('region', { name: common.kit.houseScene.closeUp(rooms[i]) });
    await expect(closeUp.getByText(game.clues.opened)).toBeVisible();
    await closeUp.getByRole('button', { name: common.kit.houseScene.back }).click();
    await expect(closeUp).toHaveCount(0);

    const guess = String(2500 + i * 1000);
    const input = page.getByRole('textbox', { name: game.guess.input });
    if (isMobile) await input.tap();
    else await input.click();
    await page.keyboard.type(guess);
    await input.blur();
    await page.getByRole('button', { name: /^Lock in/ }).click();

    // The reveal: the real cost, scored with the room that was opened.
    await expect(h1(page)).toHaveText(game.screens.S3);
    await expect(page.getByRole('figure', { name: /Your guess/ })).toBeVisible();
    await expect(page.getByText(/for 1 room opened/)).toBeVisible();
    await page.getByRole('button', { name: game.reveal.next }).click();
  }
  await expect(page.getByText(game.progress(4, 5))).toBeVisible();

  // ----- 2. Guess your own month (S5) -----
  await page.goto('/me/guess');
  await expect(h1(page)).toHaveText(ladder.screens.S5);
  const own = page.getByRole('slider', { name: ladder.guess.sliderLabel });
  await own.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: ladder.guess.submit }).click();
  await expect(page.getByRole('region', { name: ladder.guess.compareTitle })).toBeVisible();
  await expect(page.getByTestId('guess-verdict')).not.toBeEmpty();

  // ----- 3. Closest life (S6), from today's homes -----
  await page.getByRole('link', { name: ladder.shell.next(ladder.screens.S6) }).click();
  await expect(page).toHaveURL(/\/me\/closest$/);
  const choose = page.getByRole('button', { name: new RegExp(`^${ladder.closest.choose}`) }).first();
  await choose.click();
  await expect(choose).toHaveAttribute('aria-pressed', 'true');

  // ----- 4. Sliders (S7): the month and the 10-year number follow -----
  await page.getByRole('link', { name: ladder.shell.next(ladder.screens.S7) }).click();
  await expect(page).toHaveURL(/\/me\/sliders$/);
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  const monthCost = page.getByTestId('month-cost');
  const costBefore = await monthCost.textContent();
  await eatingOut.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(monthCost).not.toHaveText(costBefore ?? '');
  await expectNoSideScroll(page);

  // ----- 5. You in 10 years (S10): the range band and the next moves -----
  await page.getByRole('link', { name: ladder.shell.futureCta }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(h1(page)).toHaveText(forecast.future.title);
  const chart = page.getByRole('figure', { name: forecast.future.chartTitle });
  await expect(chart.locator('.recharts-line-curve').first()).toBeVisible();
  await expect(chart.locator('.recharts-area-area').first()).toBeVisible();
  await expect(page.getByTestId('in10y').getByText(/^Likely between \$[\d,]+ and \$[\d,]+$/)).toBeVisible();
  await expect(page.getByTestId('moves').getByRole('article').first()).toBeVisible();

  // ----- 6. Upload the sample statement (S9): estimates become measured, the range tightens -----
  await page.goto('/me/upload');
  const range = page.getByTestId('ladder-range');
  await expect(range).toBeVisible();
  const rangeBefore = await range.textContent();
  await page.getByLabel(ladder.upload.pickerLabel).setInputFiles(SAMPLE_STATEMENT);
  await expect(page.getByRole('region', { name: ladder.upload.monthLabel('2026-10') })).toBeVisible();
  await page.getByRole('button', { name: ladder.upload.apply }).click();
  await expect(page.getByText(ladder.upload.applied)).toBeVisible();
  await expect(range).not.toHaveText(rangeBefore ?? '');

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
  const opened = sentEvents.filter((e) => e.name === 'clue_opened');
  expect(opened.map((e) => (e as Extract<ClientFunnelEvent, { name: 'clue_opened' }>).props)).toEqual([
    { home: 1, clue: 'kitchen' }, { home: 2, clue: 'garage' }, { home: 3, clue: 'mailbox' },
  ]);
  const guessed = sentEvents.filter((e) => e.name === 'home_guessed');
  expect(guessed.map((e) => (e as Extract<ClientFunnelEvent, { name: 'home_guessed' }>).props)).toEqual([
    { home: 1, cluesOpened: 1 }, { home: 2, cluesOpened: 1 }, { home: 3, cluesOpened: 1 },
  ]);

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
