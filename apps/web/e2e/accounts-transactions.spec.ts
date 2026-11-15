// P2 Accounts and P3 Transactions, phone and desktop: the demo accounts saved in this browser
// (accounts.demo.json), net worth and the groups, an account page, adding an account through the sheet;
// then Transactions on a fresh ledger: the empty state points to the CSV import, a line added by hand
// shows up, and a category is changed. No page scrolls sideways on a phone.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { accounts as a } from '../src/copy/accounts';
import { transactions as t } from '../src/copy/transactions';

const accountsDemo = JSON.parse(readFileSync(new URL('../../../packages/data/fixtures/accounts.demo.json', import.meta.url), 'utf8')) as unknown;

// Sunday 15 November 2026, noon in the browser's time zone (the fixtures' month).
const NOW = new Date(2026, 10, 15, 12);

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
  await page.clock.setFixedTime(NOW);
  await page.addInitScript((accounts) => {
    if (localStorage.getItem('lifeguessr.accounts')) return;
    localStorage.setItem('lifeguessr.accounts', JSON.stringify({ version: 1, accounts }));
  }, accountsDemo);
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('accounts: net worth, groups, an account page and adding an account', async ({ page }) => {
  await page.goto('/accounts');
  await expect(page.getByRole('heading', { level: 1, name: a.title })).toBeVisible();
  await expect(page.getByTestId('accounts-networth-value')).toBeVisible();
  await expect(page.getByTestId('accounts-group-cash')).toBeVisible();
  await expectNoSideScroll(page);

  // One account's page, and back.
  await page.getByTestId('accounts-group-creditCard').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/accounts\/card-1$/);
  await expect(page.getByTestId('account-balance')).toBeVisible();
  await expect(page.getByTestId('account-summary')).toBeVisible();
  await expectNoSideScroll(page);
  await page.getByRole('link', { name: a.detailScreen.backToAccounts }).first().click();
  await expect(page).toHaveURL(/\/accounts$/);

  // Add a savings account through the sheet.
  const before = await page.getByTestId('accounts-networth-value').textContent();
  await page.getByTestId('accounts-add').click();
  await page.getByTestId('add-account-type-cash').click();
  await page.getByTestId('add-account-name').fill('Rainy day');
  await page.getByTestId('add-account-balance').fill('1000');
  await page.getByTestId('add-account-submit').click();
  await expect(page.getByTestId('accounts-group-cash').getByRole('link', { name: /Rainy day/ })).toBeVisible();
  await expect(page.getByTestId('accounts-networth-value')).not.toHaveText(before ?? '');
});

test('transactions: empty state, manual add and a category change', async ({ page }) => {
  await page.goto('/transactions');
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible();
  const empty = page.getByTestId('transactions-empty');
  await expect(empty).toBeVisible();
  await expect(empty.getByRole('link', { name: t.screen.importGuided })).toHaveAttribute('href', '/me/upload');
  // One import control, not two.
  await expect(empty.getByText(t.import, { exact: true })).toHaveCount(1);
  await expect(page.getByTestId('transactions-import')).toHaveCount(0);
  await expectNoSideScroll(page);

  await page.getByTestId('transactions-add').click();
  await page.getByTestId('add-transaction-date').fill('2026-11-14');
  await page.getByTestId('add-transaction-label').fill('Corner cafe');
  await page.getByTestId('add-transaction-amount').fill('4.50');
  await page.getByTestId('add-transaction-submit').click();

  const row = page.getByTestId('transaction-row').filter({ hasText: 'Corner cafe' });
  await expect(row).toBeVisible();
  await expect(page.getByTestId('transactions-summary-count')).toHaveText('1');
  await expectNoSideScroll(page);

  // With lines, "Import CSV" opens one panel: the file picker plus the guided path.
  await page.getByTestId('transactions-import').click();
  const panel = page.getByTestId('transactions-import-panel');
  await expect(panel.getByRole('link', { name: t.screen.importGuided })).toHaveAttribute('href', '/me/upload');
  await expect(panel.getByLabel(t.screen.importFile)).toBeAttached();

  await row.getByRole('combobox').selectOption('eatingOut');
  await expect(row.getByRole('combobox')).toHaveValue('eatingOut');

  // It is still there after a reload (IndexedDB in this browser).
  await page.reload();
  await expect(page.getByTestId('transaction-row').filter({ hasText: 'Corner cafe' })).toBeVisible();
});
