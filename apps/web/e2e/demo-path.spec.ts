// T8: the 2-minute demo path (docs/PRODUCT.md → Two-minute demo script) in one spec, phone and
// desktop: the landing's Start → the onboarding story (3 practice duels → guess your month → ZIP and
// household → the sample statement → guess vs. reality → the plan to 90 with Chance of success and Next
// Moves) → Open my dashboard → "/" now goes to the dashboard → today's five duels at /play (a hint in the
// first) → fine-tune by hand → Loan Lab compare. Selectors come from the copy files and roles, so a
// Figma restyle does not break it.
//
// It runs in both ways the duel can be built, with the same steps: against the server
// (NEXT_PUBLIC_DUEL_SOURCE=api, production's build: CI's e2e-production job, with the store) and in
// the browser (the default build, CI's e2e job). The slider game (NEXT_PUBLIC_GAME_MODE=slider, the
// rollback) has its own spec, play.spec.ts.
//
// When the build sends funnel events (NEXT_PUBLIC_EVENTS_SOURCE=api with a store, as CI's e2e job
// runs it), it also checks that each step of the path was recorded, that what was sent carries no
// personal data, and that GET /api/events/funnel counts it.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page, type Request } from '@playwright/test';
import type { ClientFunnelEvent, FunnelReport } from '@lifeguessr/types';
import { common } from '../src/copy/common';
import { duel } from '../src/copy/duel';
import { ladder } from '../src/copy/ladder';
import { loan } from '../src/copy/loan';
import { onboarding } from '../src/copy/onboarding';

const SAMPLE_STATEMENT = fileURLToPath(new URL('../../../packages/data/fixtures/statement.sample.csv', import.meta.url));
const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_SOURCE === 'api';

/** The funnel steps this path goes through, in the order it reaches them. */
const PATH_EVENTS = [
  'own_guess_submitted', 'closest_life_chosen', 'statement_applied', 'play_started', 'hint_opened', 'duel_picked',
  'sliders_adjusted', 'loan_compared',
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

test('demo path: landing → story (practice, guess, statement, plan) → dashboard → 5 duels → by hand → Loan Lab', async ({ page }) => {
  test.setTimeout(150_000);
  const o = onboarding;

  // ----- 0. A first visit: the landing, one Start -----
  await page.goto('/');
  await expect(h1(page)).toHaveText(o.landing.title);
  await expectNoSideScroll(page);
  await page.getByRole('link', { name: o.landing.start, exact: true }).click();
  await expect(page).toHaveURL(/\/start$/);

  // ----- 1. Chapter 1: three practice duels (not the daily five), then the average error -----
  await expect(h1(page)).toHaveText(o.story.chapters[1].title);
  await expect(page.getByText(o.practice.note)).toBeVisible();
  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(o.practice.round(round, 3))).toBeVisible();
    await page.getByRole('button', { name: /^Life A costs more/ }).click();
    const own = page.getByRole('slider', { name: o.practice.guessLabel('A') });
    await own.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: o.practice.reveal }).click();
    for (const letter of ['A', 'B'] as const) {
      await expect(page.getByTestId(`practice-total-value-${letter}`)).toHaveAttribute('data-value', /^\$[\d,]+$/);
      await expect(page.getByRole('list', { name: o.practice.barsLabel(letter) })).toBeVisible();
    }
    await page.getByRole('button', { name: round === 3 ? o.practice.finish : o.practice.next }).click();
  }
  await expect(page.getByTestId('practice-average')).toHaveText(/^You were off by \d+% on average\.$/);
  await expectNoSideScroll(page);
  await page.getByRole('button', { name: o.practice.onward }).click();

  // ----- 2. Chapter 2: the gut guess, then ZIP + household -----
  await expect(page).toHaveURL(/\/start\?ch=2$/);
  await expect(h1(page)).toHaveText(o.story.chapters[2].title);
  const guess = page.getByRole('slider', { name: ladder.guess.sliderLabel });
  await guess.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  const ownGuess = stored(page, 'own_guess_submitted');
  await page.getByRole('button', { name: o.guess.lock }).click();
  await ownGuess;
  await expect(page.getByRole('button', { name: o.guess.next })).toBeDisabled();
  await expect(page.getByTestId('zip-needed')).toHaveText(ladder.closest.about.zipNeeded);
  await page.getByLabel(ladder.closest.about.zip).fill('75205');
  const chosen = stored(page, 'closest_life_chosen');
  await page.getByRole('button', { name: o.guess.next }).click();
  await chosen;

  // ----- 3. Chapter 3: import a bank CSV (the sample file), then guess vs. reality -----
  await expect(page).toHaveURL(/\/start\?ch=3$/);
  await page.getByLabel(ladder.upload.pickerLabel).setInputFiles(SAMPLE_STATEMENT);
  await expect(page.getByTestId('statement-summary')).toBeVisible({ timeout: 20_000 });
  const applied = stored(page, 'statement_applied');
  await page.getByRole('button', { name: o.month.use }).click();
  await applied;
  const reveal = page.getByTestId('month-reveal');
  await expect(reveal).toHaveAttribute('data-from', 'statement');
  await expect(page.getByTestId('reveal-guess')).toHaveAttribute('data-value', /^\$[\d,]+$/);
  await expect(page.getByTestId('reveal-actual')).toHaveAttribute('data-value', /^\$[\d,]+$/);
  await expect(page.getByRole('list', { name: o.month.breakdownLabel }).getByRole('listitem').first()).toBeVisible();
  await expectNoSideScroll(page);
  await page.getByRole('button', { name: o.month.onward }).click();

  // ----- 4. Chapter 4: the plan to 90, Chance of success (Monte Carlo), the next moves -----
  await expect(page).toHaveURL(/\/start\?ch=4$/);
  await expect(page.getByTestId('story-plan-line')).toBeVisible();
  await expect(page.getByTestId('story-chance')).toHaveAttribute('data-status', 'done', { timeout: 20_000 });
  await expect(page.getByRole('meter', { name: o.future.chanceLabel })).toHaveAttribute('aria-valuetext', /^\d+%$/);
  await expect(page.getByTestId('story-moves').getByRole('listitem').first()).toBeVisible();
  await expectNoSideScroll(page);
  await page.getByRole('link', { name: o.future.dashboard }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // The story is finished: "/" now opens the dashboard.
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);

  // ----- 5. Play today's five duels at /play -----
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
  if (EVENTS_ON) await expect.poll(() => sentEvents.filter((e) => e.name === 'duel_picked').length, { timeout: 10_000 }).toBe(5);

  // ----- 6. Fine-tune by hand (S7): the month follows -----
  await page.goto('/me/sliders');
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  const monthCost = page.getByTestId('month-cost');
  const costBefore = await monthCost.textContent();
  const adjusted = stored(page, 'sliders_adjusted');
  await eatingOut.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(monthCost).not.toHaveText(costBefore ?? '');
  await adjusted;
  await expectNoSideScroll(page);

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
