// P1 Dashboard (/dashboard) in a fresh browser on a phone (390px): the greeting, the setup checklist
// computed from the (empty) stores, the plan card with the engine's Chance of success, empty states that
// point to the right screens, today's game card, and no sideways scroll. Selectors come from the copy.
import type { Page } from '@playwright/test';
import { dashboard as t } from '../src/copy/dashboard';
import { expect, test } from './tools/fixtures';

test.use({ viewport: { width: 390, height: 844 } });

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('Dashboard: widgets, checklist, Chance of success and empty states', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible();

  // Nothing entered yet: the checklist shows 0 of 6 and links to where each step happens.
  const checklist = page.getByTestId('dashboard-checklist');
  await expect(checklist).toBeVisible();
  await expect(checklist.getByText('0 of 6 done')).toBeVisible();
  await expect(checklist.getByRole('link', { name: t.checklist.addedAccounts })).toHaveAttribute('href', '/accounts?add=1');
  await expect(checklist.getByRole('link', { name: t.checklist.setBudget })).toHaveAttribute('href', '/budget');

  // The plan card: the engine's Monte Carlo run finishes and shows as a meter; "Open plan" goes to /plan.
  const plan = page.getByTestId('dashboard-plan');
  await expect(plan.getByRole('meter', { name: t.chance })).toBeVisible({ timeout: 15_000 });
  await expect(plan.getByRole('meter', { name: t.chance })).toHaveAttribute('aria-valuetext', /^\d+%$/);
  await expect(plan.getByRole('link', { name: t.open })).toHaveAttribute('href', '/plan');

  // Net worth starts from the sample profile's accounts (the sample banner says so).
  await expect(page.getByTestId('dashboard-net-worth-value')).toBeVisible();
  // Empty states point to the right screens.
  await expect(page.getByTestId('dashboard-spending').getByRole('link', { name: t.spendingEmpty.cta })).toHaveAttribute('href', '/transactions?import=1');
  await expect(page.getByTestId('dashboard-budget').getByRole('link', { name: t.budgetEmpty.cta })).toHaveAttribute('href', '/budget');
  await expect(page.getByTestId('dashboard-goals').getByRole('link', { name: t.goalsEmpty.cta })).toHaveAttribute('href', '/goals');

  // Today's game.
  const game = page.getByTestId('dashboard-game');
  await expect(game.getByText(t.duelQuestion)).toBeVisible();
  await expect(game.getByRole('link', { name: t.duelPlay })).toHaveAttribute('href', '/play');
  await noSideScroll(page);

  // Dismissing the checklist hides it.
  await checklist.getByRole('button', { name: t.dismissLabel }).click();
  await expect(page.getByTestId('dashboard-checklist')).toHaveCount(0);
});
