// /duel against the server (NEXT_PUBLIC_DUEL_SOURCE=api, with NEXT_PUBLIC_GAME_SOURCE=api as
// production builds): today's five come from GET /api/daily?game=duel, every pick and the hint are
// POSTed and scored by the server, and the day's progress lives in the store, keyed by the
// browser's anonymous id. The spec plays a day: a hint on round 1, tap A on all five rounds, a
// reload in the middle (and a cleared tab) resuming from the server, then the day result.
// A second test plays the challenge: one player finishes the day and copies the challenge link, a
// stranger (a new browser context, so a new anonymous id) opens it and sees that player's real score
// from the server, and the day result sets the two side by side.
// Runs only in a duel API build with a store: CI's e2e-duel-api job (Postgres), or `next dev`
// (memory store) with E2E_BASE_URL. The fixture duel has its own spec, duel.spec.ts.
import { expect, test, type Page, type Response } from '@playwright/test';
import { duel as t } from '../src/copy/duel';

test.skip(process.env.NEXT_PUBLIC_DUEL_SOURCE !== 'api', 'the build plays the duel in the browser (NEXT_PUBLIC_DUEL_SOURCE=api plays it against the server)');

const ANON_ID_KEY = 'lifeguessr.anonId';
const DUEL_VIEW_KEY = 'lifeguessr.duelView';
const FIXTURE_DUEL_LOG_KEY = 'lifeguessr.fixtureDuel';

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

const pickLetter = (page: Page, letter: 'A' | 'B') => page.getByRole('button', { name: new RegExp(`^Life ${letter} costs more`) });
const pickA = (page: Page) => pickLetter(page, 'A');
const isRoute = (path: string, method: string) => (res: Response) =>
  new URL(res.url()).pathname === path && res.request().method() === method;

/** Tap a life on the round on screen and wait for the server's scored reply (200, a PickResult). */
async function pickOnServer(page: Page, round: number, letter: 'A' | 'B') {
  await expect(page.getByText(t.round(round, 5))).toBeVisible();
  const [res] = await Promise.all([page.waitForResponse(isRoute('/api/daily/pick', 'POST')), pickLetter(page, letter).click()]);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { points: number; correct: boolean; replayed: boolean };
  expect(body.replayed).toBe(false);
  // The browser sent no score, no hint count and no total: only who, which day, which round, which life.
  expect(Object.keys(res.request().postDataJSON() as object).sort()).toEqual(['anonId', 'choice', 'date', 'round']);
  await expect(page.getByText(/^Right! \+[\d,]+ points$|^Not this time · 0 points$/)).toBeVisible();
  return body;
}
const pickAOnServer = (page: Page, round: number) => pickOnServer(page, round, 'A');

/** Plays the five rounds on screen (the same letter each round), ending on the day result. */
async function playDay(page: Page, letter: 'A' | 'B') {
  const results = [];
  for (let round = 1; round <= 5; round++) {
    results.push(await pickOnServer(page, round, letter));
    await page.getByRole('button', { name: round === 5 ? t.reveal.finish : t.reveal.next }).click();
  }
  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
  return { results, right: results.filter((r) => r.correct).length, points: results.reduce((sum, r) => sum + r.points, 0) };
}

async function expectNoSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('a full duel day against the server: hint, five picks, a reload mid-day resumes, the day result', async ({ page, browser }) => {
  const [daily] = await Promise.all([
    page.waitForResponse((res) => new URL(res.url()).pathname === '/api/daily' && new URL(res.url()).searchParams.get('game') === 'duel'),
    page.goto('/duel'),
  ]);
  expect(daily.status()).toBe(200);
  const { date } = (await daily.json()) as { date: string }; // read before any navigation
  expect(daily.request().headers()['x-anon-id']).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
  // Scored on the server: the footer no longer says "in your browser".
  await expect(page.getByTestId('duel-footer')).toHaveText(t.footer.composite);

  // Round 1 with the hint: the server records it, then scores the pick at 90%.
  const [hint] = await Promise.all([
    page.waitForResponse(isRoute('/api/daily/hint', 'POST')),
    page.getByRole('button', { name: t.hint.offer('10%') }).click(),
  ]);
  expect(hint.status()).toBe(200);
  expect(((await hint.json()) as { recorded: boolean }).recorded).toBe(true);
  await expect(page.getByText(t.hint.used('900'))).toBeVisible();
  const r1 = await pickAOnServer(page, 1);
  expect([0, 900]).toContain(r1.points);
  await page.getByRole('button', { name: t.reveal.next }).click();

  const r2 = await pickAOnServer(page, 2);

  // A reload mid-day: the reveal of round 2 is back (the server's progress, this tab's view).
  await page.reload();
  await expect(page.getByText(/^Right! \+[\d,]+ points$|^Not this time · 0 points$/)).toBeVisible();
  await expect(page.getByRole('button', { name: t.reveal.next })).toBeVisible();
  await page.getByRole('button', { name: t.reveal.next }).click();
  await expect(page.getByText(t.round(3, 5))).toBeVisible();

  // A cleared tab (only the anonymous id survives): the server alone resumes the day at round 3.
  await page.evaluate((key) => localStorage.removeItem(key), DUEL_VIEW_KEY);
  await page.reload();
  await expect(page.getByText(t.round(3, 5))).toBeVisible();
  // Nothing about the day is kept in the browser's fixture log: the server holds it.
  expect(await page.evaluate((key) => localStorage.getItem(key), FIXTURE_DUEL_LOG_KEY)).toBeNull();

  const rest = [];
  for (let round = 3; round <= 5; round++) {
    rest.push(await pickAOnServer(page, round));
    await page.getByRole('button', { name: round === 5 ? t.reveal.finish : t.reveal.next }).click();
  }

  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
  await expect(page.getByRole('list', { name: t.summary.gridLabel }).getByRole('listitem')).toHaveCount(5);
  const total = [r1, r2, ...rest].reduce((s, r) => s + r.points, 0);
  // The day's points are the sum the server scored, round by round.
  await expect(page.getByText(`${t.summary.pointsLabel}: ${t.summary.points(total.toLocaleString('en-US'))}`, { exact: true })).toBeVisible();
  await expect(page.getByText(/^Next five in \d+h \d+m$/)).toBeVisible();

  // A reload keeps today's result.
  await page.reload();
  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();

  // Another browser with the same anonymous id (another device restoring it) gets the same day
  // from the server, and a repeated pick there answers the stored result instead of a second score.
  const anonId = await page.evaluate((key) => localStorage.getItem(key), ANON_ID_KEY);
  const other = await browser.newContext();
  await other.addInitScript(([key, id]) => localStorage.setItem(key, id), [ANON_ID_KEY, anonId!] as const);
  const second = await other.newPage();
  await second.goto('/duel');
  await expect(second.getByRole('heading', { name: t.summary.heading })).toBeVisible();
  const replay = await second.request.post('/api/daily/pick', {
    headers: { 'x-anon-id': anonId! },
    data: { anonId, date, round: 1, choice: 'B' },
  });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toMatchObject({ replayed: true, points: r1.points });
  await other.close();
});

test('a challenge link: a stranger sees the friend’s real score, then the day result sets the two side by side', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  // Player 1 plays the day, tapping A every round, and copies the challenge link.
  await page.goto('/duel');
  const one = await playDay(page, 'A');
  await page.getByRole('button', { name: t.summary.copyChallenge(one.right, 5) }).click();
  await expect(page.getByText(t.summary.copyStatus.copied)).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/duel\?c=[0-9a-f]{32}$/);

  // Their own link is their result, not a comparison.
  await page.goto(link);
  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
  await expect(page.getByRole('region', { name: t.challenge.heading })).toHaveCount(0);
  await expect(page.getByText(t.challenge.generic)).toHaveCount(0);

  // Player 2: another browser context, so another anonymous id and fresh storage. They tap B every
  // round, so their day is the mirror of player 1's.
  const stranger = await browser.newContext();
  const errors: string[] = [];
  const two = await stranger.newPage();
  two.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  two.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  const [challenge] = await Promise.all([
    two.waitForResponse(isRoute('/api/daily/challenge', 'GET')),
    two.goto(link),
  ]);

  // The reply is the friend's score from the server, and only that: no key, no choices, no totals.
  expect(challenge.status()).toBe(200);
  const body = (await challenge.json()) as Record<string, unknown>;
  expect(body).toEqual({
    ok: true,
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    rounds: 5,
    played: 5,
    right: one.right,
    points: one.points,
    tiles: one.results.map((r) => (r.correct ? 'green' : 'ink')),
    today: true,
  });
  expect(challenge.request().headers()['x-anon-id']).toBeUndefined();

  // Before the first round: whose score to beat.
  const friendLine = t.challenge.friendScore(one.right, 5, one.points.toLocaleString('en-US'));
  await expect(two.getByText(friendLine)).toBeVisible();
  await expect(two.getByText(t.round(1, 5))).toBeVisible();
  await expect(two.getByText(t.challenge.generic)).toHaveCount(0);
  await expectNoSideScroll(two);

  const second = await playDay(two, 'B');
  expect(second.right).toBe(5 - one.right); // B is the other life in every round

  // The day result: both scores, who is ahead, and both grids.
  const versus = two.getByRole('region', { name: t.challenge.heading });
  await expect(versus).toBeVisible();
  await expect(versus.getByText(t.challenge.headline(second.right, one.right, 5))).toBeVisible();
  const outcome = second.right > one.right ? 'ahead' : second.right < one.right ? 'behind' : 'tied';
  await expect(versus.getByText(t.challenge.outcome[outcome])).toBeVisible();
  await expect(versus.getByRole('list', { name: t.summary.gridLabel }).getByRole('listitem')).toHaveCount(5);
  await expect(versus.getByRole('list', { name: t.challenge.friendGridLabel }).getByRole('listitem')).toHaveCount(5);
  await expect(versus.getByText(t.summary.points(second.points.toLocaleString('en-US')))).toBeVisible();
  await expect(versus.getByText(t.summary.points(one.points.toLocaleString('en-US')))).toBeVisible();
  await expectNoSideScroll(two);

  expect(errors, errors.join('\n')).toEqual([]);
  await stranger.close();
});

test('a challenge link nobody holds shows the generic line, and the day plays', async ({ page }) => {
  const [challenge] = await Promise.all([
    page.waitForResponse(isRoute('/api/daily/challenge', 'GET')),
    page.goto(`/duel?c=${'0'.repeat(32)}`),
  ]);
  expect(challenge.status()).toBe(404);
  await expect(page.getByText(t.challenge.generic)).toBeVisible();
  await expect(page.getByText(t.round(1, 5))).toBeVisible();
  await expect(pickA(page)).toBeEnabled();
  // The browser itself logs the 404 of the lookup (once per request: `next dev` runs effects twice).
  // That is the expected answer for this link; any other console error still fails the test.
  pageErrors = pageErrors.filter((e) => !e.includes('Failed to load resource: the server responded with a status of 404'));
});
