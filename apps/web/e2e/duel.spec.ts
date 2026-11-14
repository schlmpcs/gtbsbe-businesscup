// /duel (S2 Duel round, S3 Reveal, S3 Day result) in a real browser on the fixture duel: tap a
// life → the reveal shows both monthly totals → next round; then the rest of the day to the result.
// A duel API build (NEXT_PUBLIC_DUEL_SOURCE=api) runs duel-api.spec.ts instead.
// Selectors come from the copy file and roles. Runs on the phone and desktop projects.
import { expect, test, type Page } from '@playwright/test';
import { duel as t } from '../src/copy/duel';
import { forecast } from '../src/copy/forecast';

test.skip(process.env.NEXT_PUBLIC_DUEL_SOURCE === 'api', 'the build plays the duel against the server: duel-api.spec.ts');

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

async function expectNoSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

const pickA = (page: Page) => page.getByRole('button', { name: /^Life A costs more/ });
const MONEY = /\$[\d,]+/;

test('tap card A → the reveal shows both monthly totals → next round', async ({ page }) => {
  await page.goto('/duel');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
  await expect(page.getByText(t.round(1, 5))).toBeVisible();
  await expect(page.getByRole('button', { name: /^Life B costs more/ })).toBeVisible();
  await expectNoSideScroll(page);

  await pickA(page).click();

  // Result pill and headline.
  await expect(page.getByText(/^Right! \+1,000 points$|^Not this time · 0 points$/)).toBeVisible();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(/^[AB] costs \$[\d,]+ more a month\.$|They cost the same/);
  // Both monthly totals, each with its category breakdown.
  for (const letter of ['A', 'B'] as const) {
    const breakdown = page.getByRole('list', { name: t.reveal.breakdownLabel(letter) });
    await expect(breakdown).toBeVisible();
    const card = page.getByRole('article').filter({ has: breakdown });
    await expect(card.getByText(MONEY).first()).toBeVisible();
  }
  await expect(page.getByText(t.reveal.decidedHeading)).toBeVisible();
  await expect(page.getByText(t.reveal.crowdNone)).toBeVisible();
  await expectNoSideScroll(page);

  await page.getByRole('button', { name: t.reveal.next }).click();
  await expect(page.getByText(t.round(2, 5))).toBeVisible();
  await expect(pickA(page)).toBeEnabled();
});

test('a hint, then the rest of the day, ends on the day result with the bridge to S5', async ({ page }) => {
  await page.goto('/duel');
  await page.getByRole('button', { name: t.hint.offer('10%') }).click();
  await expect(page.getByText(t.hint.used('900'))).toBeVisible();

  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(t.round(round, 5))).toBeVisible();
    await pickA(page).click();
    await page.getByRole('button', { name: round === 5 ? t.reveal.finish : t.reveal.next }).click();
  }

  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
  await expect(page.getByRole('list', { name: t.summary.gridLabel }).getByRole('listitem')).toHaveCount(5);
  await expect(page.getByText(t.summary.blindSpotHeading)).toBeVisible();
  await expect(page.getByText(/^Next five in \d+h \d+m$/)).toBeVisible();
  await expect(page.getByRole('link', { name: t.summary.cta })).toHaveAttribute('href', '/me/guess');
  await expectNoSideScroll(page);

  // A reload keeps today's result.
  await page.reload();
  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
});

test('/play is the duel: one pick shows on S1 Today as rounds, not homes, with no streamer link', async ({ page }) => {
  await page.goto('/play');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
  // Honest about where it is scored while the duel plays in the browser.
  await expect(page.getByTestId('duel-footer')).toHaveText(`${t.footer.composite} ${t.footer.browser}`);
  await pickA(page).click();
  await expect(page.getByRole('button', { name: t.reveal.next })).toBeVisible();

  await page.goto('/');
  const p = forecast.today.playDuel;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(forecast.today.home.title);
  const game = page.getByTestId('play');
  await expect(game).toContainText(forecast.today.duel.title);
  await expect(game.getByRole('link', { name: p.continue(1, 5) })).toHaveAttribute('href', '/play');
  await expect(page.getByText(/today’s homes/i)).toHaveCount(0);
  await expect(page.locator('a[href*="stream=1"]')).toHaveCount(0);
});
