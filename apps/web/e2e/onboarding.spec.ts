// /start onboarding end to end: one warm-up round of today's duel → guess → demo bank connection (the sample statement through the real
// parser and categorizer) → the analysis of the statement → net worth reveal → plan to 90 → one decision → Home with the Life line.
import { expect, test } from '@playwright/test';
import { lifeline } from '../src/copy/lifeline';
import { welcome as t } from '../src/copy/welcome';

test('onboarding: warm-up duel, guess, connect a bank (demo), see what you are worth, drag one decision', async ({ page }) => {
  await page.goto('/start');
  const warmup = page.getByTestId('duel-warmup');
  await expect(warmup).toBeVisible();
  // Pick either life (aria-label "Life A costs more: …"); retried until hydrated and the round has loaded.
  await expect(async () => {
    await warmup.getByRole('button', { name: /^Life [AB] costs more/ }).first().click({ timeout: 2_000 });
    await expect(warmup.getByRole('button', { name: t.warmup.cta })).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await warmup.getByRole('button', { name: t.warmup.cta }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.guess.title);
  // Retried until the page is hydrated (a fill before that is reset by React).
  await expect(async () => {
    await page.locator('#ob-guess').fill('40000');
    await expect(page.getByTestId('onboarding-guess')).toHaveText('$40,000', { timeout: 1_000 });
  }).toPass();
  await page.getByTestId('onboarding-lock').click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.connect.title);
  await page.getByTestId('bank-chase').click();
  await expect(page.getByTestId('onboarding-connecting')).toContainText(t.connecting.title('Chase'));

  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'analyzing', { timeout: 60_000 });
  await expect(page.getByTestId('onboarding-analyzing')).toBeVisible();
  await expect(page.getByTestId('onboarding')).toHaveAttribute('data-step', 'reveal', { timeout: 30_000 });
  await expect(page.getByTestId('onboarding-networth')).toHaveText(/^−?\$[\d,]+$/);
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
