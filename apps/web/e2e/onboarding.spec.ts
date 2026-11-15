// /start onboarding end to end: one warm-up round of today's duel → about you → guess → demo bank connection (the sample
// statement through the real parser and categorizer) → the analysis of the statement → "Here's what we found" (Checking &
// savings prefilled from the statement's last balance, the rest typed) → net worth reveal → plan to 90 → one decision →
// the dashboard. A second walk uploads a statement (CSV) instead of picking a bank.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { lifeline } from '../src/copy/lifeline';
import { welcome as t } from '../src/copy/welcome';

const STATEMENT_WITH_BALANCE = fileURLToPath(
  new URL('../../../packages/data/fixtures/synthetic-statements/hh13-elk-grove-single-income-family.csv', import.meta.url),
);

/** The warm-up round, About you and the guess: lands on the bank picker. */
async function toConnect(page: Page) {
  await page.goto('/start');
  const warmup = page.getByTestId('duel-warmup');
  await expect(warmup).toBeVisible();
  // Pick either life (aria-label "Life A costs more: …"); retried until hydrated and the round has loaded.
  await expect(async () => {
    await warmup.getByRole('button', { name: /^Life [AB] costs more/ }).first().click({ timeout: 2_000 });
    await expect(warmup.getByRole('button', { name: t.warmup.cta })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await warmup.getByRole('button', { name: t.warmup.cta }).click();

  // ----- About you: age, ZIP, household, take-home pay (the person's own, not the sample's) -----
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'about');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.about.title);
  await page.getByTestId('ob-age').fill('41');
  await page.getByTestId('ob-zip').fill('94110');
  await page.getByTestId('ob-takeHome').fill('7250');
  await page.getByTestId('ob-adults-2').click();
  await page.getByTestId('onboarding-about-next').click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.guess.title);
  // Retried until the page is hydrated (a fill before that is reset by React).
  await expect(async () => {
    await page.locator('#ob-guess').fill('40000');
    await expect(page.getByTestId('onboarding-guess')).toHaveText('$40,000', { timeout: 1_000 });
  }).toPass();
  await page.getByTestId('onboarding-lock').click();

  // ----- The bank comes first: balance and spending in one connection -----
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'connect');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.connect.title);
}

test('onboarding: warm-up duel, guess, connect a bank (demo), confirm what it found, see what you are worth, drag one decision', async ({ page }) => {
  await toConnect(page);
  await page.getByTestId('bank-chase').click();
  await expect(page.getByTestId('onboarding-connecting')).toContainText(t.connecting.title('Chase'));

  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'analyzing', { timeout: 60_000 });
  await expect(page.getByTestId('onboarding-analyzing')).toBeVisible();

  // ----- Here's what we found: the sample statement's last balance ($7,339.80), the rest is the person's -----
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'found', { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.balances.title);
  await expect(page.getByTestId('ob-cash')).toHaveValue('7,340');
  await expect(page.getByText(t.balances.from.bank('Chase'))).toBeVisible();
  await expect(page.getByText(t.balances.elsewhere.bank('Chase'))).toBeVisible();
  await expect(page.getByTestId('ob-retirement')).toHaveValue('');
  await page.getByTestId('ob-retirement').fill('30,000');
  await page.getByTestId('ob-card').fill('4000');
  await page.getByTestId('ob-student').fill('20000');
  await page.getByTestId('onboarding-balances-next').click();

  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'reveal');
  // 7,340 (from the statement) + 30,000 − 4,000 − 20,000: the confirmed form, not the sample household.
  await expect(page.getByTestId('onboarding-networth')).toHaveText('$13,340');
  await expect(page.getByText('$7,250/mo')).toBeVisible();
  await expect(page.getByText(t.reveal.guessed('$40,000'))).toBeVisible();
  await page.getByTestId('onboarding-next').click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.future.title);
  await page.getByTestId('onboarding-next').click();
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'decision');
  // Buy the home up to 4 years sooner than the plan's age (the slider starts there; the age depends on today's date).
  const decision = page.getByTestId('onboarding-decision');
  const planAge = Number(await decision.inputValue());
  const soonerAge = Math.max(Number(await decision.getAttribute('min')), planAge - 4);
  expect(soonerAge).toBeLessThan(planAge);
  await decision.fill(String(soonerAge));
  await expect(page.getByRole('heading', { level: 1 })).toContainText(lifeline.lead.sooner(planAge - soonerAge));

  await page.getByRole('link', { name: t.decision.cta }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // the dashboard (the Life line now lives in /start's last step)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('onboarding: an uploaded statement (CSV) takes the same path, prefilled from the file’s own balance', async ({ page }) => {
  await toConnect(page);
  // A made-up statement with a Balance column (newest line: $4,192.09), read in the browser like any upload.
  await page.getByTestId('onboarding-upload').setInputFiles(STATEMENT_WITH_BALANCE);
  await expect(page.getByTestId('onboarding-connecting')).toContainText(t.connecting.file.title);

  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'analyzing', { timeout: 60_000 });
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'found', { timeout: 30_000 });
  await expect(page.getByTestId('ob-cash')).toHaveValue('4,192');
  await expect(page.getByText(t.balances.from.file)).toBeVisible();
  await page.getByTestId('onboarding-balances-next').click();

  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'reveal');
  await expect(page.getByTestId('onboarding-networth')).toHaveText('$4,192');
  // Back from the answer reopens the form with the numbers as confirmed.
  await page.getByRole('button', { name: t.back, exact: true }).click();
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'found');
  await expect(page.getByTestId('ob-cash')).toHaveValue('4,192');
});
