// S10 goal: free users see their number and a Pro lock on the goal card; with Pro (the simulated
// checkout on the e2e server) the rules-based goal can be set, survives a reload and can be cleared.
import { expect, test } from '@playwright/test';
import { goal as g } from '../src/copy/goal';
import { forecast as t } from '../src/copy/forecast';

test('free: the number is shown and goal tracking is locked behind Pro', async ({ page }) => {
  await page.goto('/future');
  await expect(page.getByTestId('your-number')).toContainText(/\$\d/);
  const card = page.getByTestId('goal-card');
  await expect(card).toHaveAttribute('data-access', 'locked');
  await expect(card.getByRole('heading', { name: g.lock.title })).toBeVisible();
  await expect(card.getByRole('link', { name: g.lock.cta })).toHaveAttribute('href', '/pro');
  await expect(card.getByRole('button', { name: g.start, exact: true })).toHaveCount(0);
});

test('Pro: a rules-based goal persists through reload, shows in the hero, and can be cleared', async ({ page }) => {
  await page.goto('/pro');
  await page.getByRole('button', { name: /Pay \$39\.99 \(demo\)/ }).click();
  await expect(page.getByRole('heading', { name: 'You are Pro' })).toBeVisible();

  await page.goto('/future');
  const card = page.getByTestId('goal-card');
  await expect(card).toHaveAttribute('data-access', 'open');
  await card.getByRole('button', { name: g.start, exact: true }).click();
  await expect(card.getByText(/^(On track:|Within range:|Behind:)/)).toBeVisible();
  await expect(card.getByRole('progressbar')).toBeVisible();
  const year = new Date().getFullYear() + 10;
  await expect(page.getByTestId('your-number').getByTestId('number-goal')).toContainText(t.future.hero.goal('$100,000', year));
  await page.reload();
  await expect(card.getByRole('button', { name: g.clear })).toBeVisible();
  await card.getByRole('button', { name: g.clear }).click();
  await expect(card.getByRole('button', { name: g.start, exact: true })).toBeVisible();
  await expect(page.getByTestId('number-goal')).toHaveCount(0);
});
