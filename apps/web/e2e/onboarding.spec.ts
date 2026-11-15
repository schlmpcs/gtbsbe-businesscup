// The onboarding story (landing "/" → /start, 4 chapters), phone and desktop: the sliders path with a
// resume from the landing, the sample-statement path with reduced motion and the chapter dots, and the
// demo bank link (labelled a demo; its statement goes through the CSV pipeline).
// The full path with a CSV and the daily duel is demo-path.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { bankDemo as b } from '../src/copy/bankDemo';
import { common } from '../src/copy/common';
import { duel } from '../src/copy/duel';
import { ladder } from '../src/copy/ladder';
import { onboarding as o } from '../src/copy/onboarding';

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && new URL(page.url()).pathname !== '/dashboard') pageErrors.push(`console.error: ${msg.text()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });

async function noSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

async function chapter2(page: Page) {
  await expect(page).toHaveURL(/\/start\?ch=2$/);
  await expect(h1(page)).toHaveText(o.story.chapters[2].title);
  await page.getByRole('button', { name: o.guess.lock }).click();
  await page.getByLabel(ladder.closest.about.zip).fill('75205');
  await page.getByRole('button', { name: o.guess.next }).click();
  await expect(page).toHaveURL(/\/start\?ch=3$/);
}

test('sliders path: skip the practice, guess, ZIP, set the month by hand, resume from the landing, reach the plan', async ({ page }) => {
  test.slow();
  await page.goto('/');
  await expect(h1(page)).toHaveText(o.landing.title);
  await page.getByRole('link', { name: o.landing.start, exact: true }).click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByText(o.practice.note)).toBeVisible(); // practice, not the daily game
  await page.getByRole('button', { name: o.story.skipLabel(1) }).click();
  await chapter2(page);

  // Chapter 3 by hand: the month follows the sliders.
  await page.getByTestId('month-sliders').click();
  const total = page.getByTestId('month-cost');
  const before = await total.textContent();
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  await eatingOut.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(total).not.toHaveText(before ?? '');
  await noSideScroll(page);
  await page.getByRole('button', { name: o.month.showMe }).click();
  await expect(page.getByTestId('month-reveal')).toHaveAttribute('data-from', 'sliders');
  await expect(page.getByTestId('reveal-verdict')).toBeVisible();

  // Leave and come back: the landing offers to continue where the story stopped.
  await page.goto('/');
  const resume = page.getByRole('link', { name: o.landing.continue(3) });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page).toHaveURL(/\/start\?ch=3$/);
  await page.getByTestId('month-sliders').click();
  await page.getByRole('button', { name: o.month.showMe }).click();
  await page.getByRole('button', { name: o.month.onward }).click();

  // Chapter 4: the plan, the simulation (run on entering), the moves; the story is finished.
  await expect(page).toHaveURL(/\/start\?ch=4$/);
  await expect(page.getByTestId('story-chance')).toHaveAttribute('data-status', 'done', { timeout: 20_000 });
  await expect(page.getByRole('link', { name: o.future.plan })).toHaveAttribute('href', '/plan');
  await expect(page.getByRole('link', { name: o.future.exactLink })).toHaveAttribute('href', '/me/balance');
  await noSideScroll(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('sample statement path with reduced motion: final numbers at once; chapter dots go back', async ({ page }) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/start');
  // Chapter 1: each practice life shows the duel card's four fact groups (Home, Family, Car, Food).
  await expect(page.getByRole('list', { name: duel.card.factsLabel })).toHaveCount(2);
  for (const list of await page.getByRole('list', { name: duel.card.factsLabel }).all()) {
    await expect(list.getByRole('listitem')).toHaveCount(4);
    await expect(list).toContainText(duel.facts.groups.home);
    await expect(list).not.toContainText('$');
  }
  // One practice round shows both totals and the guess error.
  await page.getByRole('button', { name: /^Life B costs more/ }).click();
  await page.getByRole('button', { name: o.practice.reveal }).click();
  await expect(page.getByTestId('practice-result')).toContainText(/off|Spot on/);
  await expect(page.getByTestId('practice-total-value-B')).toHaveAttribute('data-value', /^\$[\d,]+$/);
  await page.getByRole('button', { name: o.story.skipLabel(1) }).click();
  await chapter2(page);

  await page.getByTestId('month-sample').click();
  await expect(page.getByTestId('statement-summary')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: o.month.use }).click();
  const actual = page.getByTestId('reveal-actual');
  await expect(actual).toHaveAttribute('data-value', /^\$[\d,]+$/);
  // Reduced motion: the shown number is the final one.
  expect(await actual.textContent()).toBe(await actual.getAttribute('data-value'));
  await noSideScroll(page);

  // The chapter dots go back to a reached chapter (not ahead of it).
  await expect(page.locator('[data-chapter-dot="4"]')).toBeDisabled();
  await page.locator('[data-chapter-dot="2"]').click();
  await expect(page).toHaveURL(/\/start\?ch=2$/);
  await page.locator('[data-chapter-dot="3"]').click();
  await expect(page).toHaveURL(/\/start\?ch=3$/);
  // The statement is in: the sliders show its numbers; on to the plan.
  await page.getByTestId('month-sliders').click();
  await page.getByRole('button', { name: o.month.showMe }).click();
  await expect(page.getByTestId('month-reveal')).toHaveAttribute('data-from', 'statement');
  await page.getByRole('button', { name: o.month.onward }).click();
  await expect(page.getByTestId('story-plan-line')).toBeVisible();
  await expect(page.locator('[data-chapter-dot="4"]')).toHaveAttribute('aria-current', 'step');
  await page.getByRole('link', { name: o.future.dashboard }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('demo bank path: connect a made-up test bank, its statement is read like a CSV, the reveal is from it', async ({ page }) => {
  test.slow();
  await page.goto('/start');
  await page.getByRole('button', { name: o.story.skipLabel(1) }).click();
  await chapter2(page);

  // The bank card comes first and says it is a demo with sample data.
  const card = page.getByTestId('month-bank');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('month-bank-badge')).toHaveText(b.badge);
  await expect(card).toContainText(b.disclaimer);
  // The CSV option uses our own English file button, not the browser's.
  await expect(page.getByTestId('month-csv')).toContainText(o.month.pickFile);
  await expect(page.getByTestId('month-csv-name')).toHaveText(o.month.noFile);
  await noSideScroll(page);
  await card.click();

  const sheet = page.getByTestId('bank-demo');
  await expect(sheet).toHaveAttribute('data-step', 'pick');
  await page.getByLabel(b.pick.searchLabel).fill('harbor');
  await expect(page.getByTestId('bank-demo-bank-maple')).toHaveCount(0);
  await page.getByTestId('bank-demo-bank-harbor').click();
  await expect(page.getByTestId('bank-demo-credentials-note')).toHaveText(b.signIn.note);
  await page.getByTestId('bank-demo-connect').click();
  await expect(sheet).toHaveAttribute('data-step', 'connected', { timeout: 10_000 });
  await expect(page.getByTestId('bank-demo-account-checking')).toContainText(b.connected.checking);
  await expect(page.getByTestId('bank-demo-account-card')).toContainText(b.connected.card);
  await noSideScroll(page);
  await page.getByTestId('bank-demo-use').click();

  // The same review as an uploaded CSV, then the reveal says the month is from the statement.
  await expect(page.getByTestId('statement-summary')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: o.month.use }).click();
  await expect(page.getByTestId('month-reveal')).toHaveAttribute('data-from', 'statement');
  await expect(page.getByTestId('reveal-actual')).toHaveAttribute('data-value', /^\$[\d,]+$/);
});
