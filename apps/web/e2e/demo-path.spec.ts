// T8: the 2-minute demo path (docs/PRODUCT.md → Two-minute demo script) in one spec, phone and
// desktop: the landing's Start → the onboarding at /start (one round of today's duel → guess what you
// are worth → connect a bank (demo: the sample statement through the real parser and categorizer) → the
// analysis → the net worth reveal → the plan to 90 → one decision) → Open the dashboard → "/" now goes to
// the dashboard → the rest of today's five duels at /play (the warm-up's pick counts; a hint in round 2)
// → fine-tune by hand → Loan Lab compare. Selectors come from the copy files and roles, so a Figma
// restyle does not break it.
//
// It runs in both ways the duel can be built, with the same steps: against the server
// (NEXT_PUBLIC_DUEL_SOURCE=api, production's build: CI's e2e-production job, with the store) and in
// the browser (the default build, CI's e2e job). The slider game (NEXT_PUBLIC_GAME_MODE=slider, the
// rollback) has its own spec, play.spec.ts.
//
// When the build sends funnel events (NEXT_PUBLIC_EVENTS_SOURCE=api with a store, as CI's e2e job
// runs it), it also checks that each step of the path was recorded, that what was sent carries no
// personal data, and that GET /api/events/funnel counts it.
import { expect, test, type Page, type Request } from '@playwright/test';
import type { ClientFunnelEvent, FunnelReport } from '@lifeguessr/types';
import { common } from '../src/copy/common';
import { duel } from '../src/copy/duel';
import { lifeline } from '../src/copy/lifeline';
import { loan } from '../src/copy/loan';
import { onboarding } from '../src/copy/onboarding';
import { welcome } from '../src/copy/welcome';

const EVENTS_ON = process.env.NEXT_PUBLIC_EVENTS_SOURCE === 'api';

/**
 * The funnel steps this path goes through, in the order it reaches them. The /start onboarding sends
 * play_started and duel_picked (its warm-up round is today's round 1) and statement_applied (the demo
 * bank's statement); its net worth guess is not a funnel event.
 */
const PATH_EVENTS = [
  'play_started', 'duel_picked', 'statement_applied', 'hint_opened', 'sliders_adjusted', 'loan_compared',
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

test('demo path: landing → /start (warm-up duel, guess, demo bank, reveal, plan, decision) → dashboard → 5 duels → by hand → Loan Lab', async ({ page }) => {
  test.setTimeout(150_000);
  const o = onboarding;
  const w = welcome;
  const onboardingMain = page.getByTestId('onboarding');

  // ----- 0. A first visit: the landing, one Start -----
  await page.goto('/');
  await expect(h1(page)).toHaveText(o.landing.title);
  await expectNoSideScroll(page);
  await page.getByRole('link', { name: o.landing.start, exact: true }).click();
  await expect(page).toHaveURL(/\/start$/);

  // ----- 1. The warm-up: one round of today's duel (it counts as today's round 1 on /play) -----
  await expect(onboardingMain).toHaveAttribute('data-step', 'play');
  const warmup = page.getByTestId('duel-warmup');
  await expect(warmup).toBeVisible();
  const warmupPicked = stored(page, 'duel_picked');
  // Pick Life A; retried until hydrated and the round has loaded.
  await expect(async () => {
    await warmup.getByRole('button', { name: /^Life A costs more/ }).click({ timeout: 2_000 });
    await expect(warmup.getByRole('button', { name: w.warmup.cta })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  // The reveal: the engine's monthly total of each life, with its breakdown.
  await expect(warmup.getByText(/^Right! \+[\d,]+ points$|^Not this time · 0 points$/)).toBeVisible();
  for (const letter of ['A', 'B'] as const) await expect(warmup.getByRole('list', { name: duel.reveal.breakdownLabel(letter) })).toBeVisible();
  await warmupPicked;
  await expectNoSideScroll(page);
  await warmup.getByRole('button', { name: w.warmup.cta }).click();

  // ----- 2. What are you worth? A gut guess, locked in -----
  await expect(onboardingMain).toHaveAttribute('data-step', 'guess');
  await expect(h1(page)).toHaveText(w.guess.title);
  // Retried until the page is hydrated (a fill before that is reset by React).
  await expect(async () => {
    await page.locator('#ob-guess').fill('40000');
    await expect(page.getByTestId('onboarding-guess')).toHaveText('$40,000', { timeout: 1_000 });
  }).toPass();
  await page.getByTestId('onboarding-lock').click();

  // ----- 3. Connect a bank (a labelled demo): the sample statement goes through the real pipeline -----
  await expect(h1(page)).toHaveText(w.connect.title);
  await expectNoSideScroll(page);
  const applied = stored(page, 'statement_applied');
  const categorized = page.waitForRequest((r) => r.url().endsWith('/api/statement/categorize') && r.method() === 'POST');
  await page.getByTestId('bank-chase').click();
  await expect(page.getByTestId('onboarding-connecting')).toContainText(w.connecting.title('Chase'));
  await categorized;
  await expect(onboardingMain).toHaveAttribute('data-step', 'analyzing', { timeout: 60_000 });
  await expect(page.getByTestId('onboarding-analyzing')).toBeVisible();
  await applied;

  // ----- 4. The answer: net worth from the accounts, next to the guess -----
  await expect(onboardingMain).toHaveAttribute('data-step', 'reveal', { timeout: 30_000 });
  await expect(page.getByTestId('onboarding-networth')).toHaveText(/^−?\$[\d,]+$/);
  await expect(page.getByText(w.reveal.guessed('$40,000'))).toBeVisible();
  await expectNoSideScroll(page);
  await page.getByTestId('onboarding-next').click();

  // ----- 5. The plan to 90, then one decision dragged on it -----
  await expect(h1(page)).toHaveText(w.future.title);
  await expectNoSideScroll(page);
  await page.getByTestId('onboarding-next').click();
  await expect(onboardingMain).toHaveAttribute('data-step', 'decision');
  // Buy the home up to 4 years sooner than the plan's age (the slider starts there; the age depends on today's date).
  const decision = page.getByTestId('onboarding-decision');
  const planAge = Number(await decision.inputValue());
  const soonerAge = Math.max(Number(await decision.getAttribute('min')), planAge - 4);
  expect(soonerAge).toBeLessThan(planAge);
  await decision.fill(String(soonerAge));
  await expect(h1(page)).toContainText(lifeline.lead.sooner(planAge - soonerAge));
  await expectNoSideScroll(page);
  await page.getByRole('link', { name: w.decision.cta }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // the dashboard (the Life line now lives in /start's last step)
  // The onboarding is finished: "/" now opens the dashboard.
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);

  // ----- 6. The rest of today's five duels at /play: round 1 is the warm-up's pick -----
  await page.goto('/play');
  await expect(h1(page)).toHaveText(duel.title);
  for (let round = 1; round <= 5; round++) {
    if (round > 1) {
      await expect(page.getByText(duel.round(round, 5))).toBeVisible();
      // Each life: four fact groups, and the hint explains what it opens before you pay for it.
      await expect(page.getByRole('list', { name: duel.card.factsLabel }).first().getByRole('listitem')).toHaveCount(4);
      await expect(page.getByText(duel.hint.explain)).toBeVisible();
    }
    if (round === 2) {
      // One hint in round 2: one more fact on each card, for −10% of the round's points.
      await page.getByRole('button', { name: duel.hint.offer('10%') }).click();
      await expect(page.getByText(duel.hint.used('900'))).toBeVisible();
    }
    if (round > 1) await page.getByRole('button', { name: /^Life A costs more/ }).click();
    // The reveal: both monthly totals, each with its category breakdown, computed by the engine.
    await expect(page.getByText(/^Right! \+[\d,]+ points$|^Not this time · 0 points$/)).toBeVisible();
    for (const letter of ['A', 'B'] as const) {
      const breakdown = page.getByRole('list', { name: duel.reveal.breakdownLabel(letter) });
      await expect(breakdown).toBeVisible();
      await expect(page.getByRole('article').filter({ has: breakdown }).getByText(/\$[\d,]+/).first()).toBeVisible();
    }
    await expect(page.getByTestId('duel-compare').getByText(duel.reveal.decidedTag, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: round === 5 ? duel.reveal.finish : duel.reveal.next }).click();
  }
  await expect(page.getByRole('heading', { name: duel.summary.heading })).toBeVisible();
  await expect(page.getByRole('list', { name: duel.summary.gridLabel }).getByRole('listitem')).toHaveCount(5);
  await expectNoSideScroll(page);
  if (EVENTS_ON) await expect.poll(() => sentEvents.filter((e) => e.name === 'duel_picked').length, { timeout: 10_000 }).toBe(5);

  // ----- 7. Fine-tune by hand (S7): the month follows -----
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

  // ----- 8. Loan Lab (S12): three offers side by side, the debt-load gauge, pick another -----
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
  // The duel reports its hint and each round it picked (useDuel): round 1 from the warm-up on /start.
  const hints = sentEvents.filter((e) => e.name === 'hint_opened');
  expect(hints.map((e) => (e as Extract<ClientFunnelEvent, { name: 'hint_opened' }>).props)).toEqual([{ round: 2 }]);
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
