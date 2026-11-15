// The four planner screens (MP17): Budget, Cash Flow, Recurring and Goals in a fresh browser on a phone
// (390px). With no transactions each points to onboarding or import; Budget creates a plan from the
// profile; Goals adds a Save up goal and hands Pay down to the Loan Lab. Selectors come from the copy.
import type { Page } from '@playwright/test';
import { budget } from '../src/copy/budget';
import { cashflow } from '../src/copy/cashflow';
import { goals } from '../src/copy/goals';
import { planner } from '../src/copy/planner';
import { recurring } from '../src/copy/recurring';
import { expect, test } from './tools/fixtures';

test.use({ viewport: { width: 390, height: 844 } });

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('Budget: create from my spending, then planned vs actual by group', async ({ page }) => {
  await page.goto('/budget');
  await expect(page.getByRole('heading', { level: 1, name: budget.title })).toBeVisible();
  await expect(page.getByRole('link', { name: budget.emptyLinks.upload })).toHaveAttribute('href', '/me/upload');
  await page.getByRole('button', { name: budget.create }).click();
  await expect(page.getByTestId('budget-totals')).toBeVisible();
  await expect(page.getByTestId('budget-donut')).toBeVisible();
  for (const g of Object.values(planner.budgetGroups)) await expect(page.getByRole('heading', { name: g })).toBeVisible();
  await expect(page.getByRole('textbox', { name: budget.editPlanned(planner.categories.groceries) })).toBeVisible();
  await noSideScroll(page);
});

test('Cash flow: empty state points to import', async ({ page }) => {
  await page.goto('/cashflow');
  await expect(page.getByRole('heading', { level: 1, name: cashflow.title })).toBeVisible();
  await expect(page.getByRole('heading', { name: cashflow.emptyTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: cashflow.emptyLinks.upload })).toHaveAttribute('href', '/me/upload');
  await noSideScroll(page);
});

test('Recurring: remaining due, calendar and the list', async ({ page }) => {
  await page.goto('/recurring');
  await expect(page.getByRole('heading', { level: 1, name: recurring.title })).toBeVisible();
  await expect(page.getByTestId('recurring-kpis').getByText(recurring.kpis.remaining)).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('heading', { name: recurring.sections.income })).toBeVisible();
  await noSideScroll(page);
});

test('Goals: add a Save up goal; Pay down opens the Loan Lab', async ({ page }) => {
  await page.goto('/goals');
  await expect(page.getByRole('heading', { level: 1, name: goals.title })).toBeVisible();
  await page.getByLabel(goals.form.name).fill('Emergency fund');
  await page.getByLabel(goals.form.target).fill('15000');
  await page.getByLabel(goals.form.years).fill('3');
  await page.getByRole('button', { name: goals.add }).click();
  await expect(page.getByRole('heading', { name: 'Emergency fund' })).toBeVisible();
  await expect(page.getByText(goals.monthlyToStayOnTrack)).toBeVisible();
  await noSideScroll(page);

  await page.getByRole('tab', { name: goals.tabs.payDown }).click();
  await expect(page.getByRole('link', { name: goals.payDown.cta })).toHaveAttribute('href', '/loan');
});
