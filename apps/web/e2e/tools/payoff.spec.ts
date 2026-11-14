// S12 Loan Lab, the debt payoff planner section (M13, issues #89 and #144), on the demo profile: the card ($6,400) and the car
// loan ($17,800) plus sample offer 1 as a third debt. Written against the copy and the test ids, never a calendar
// date: debt-free dates come from today, so the spec compares them with each other, not with a month name.
import type { Locator, Page } from '@playwright/test';
import { loan } from '../../src/copy/loan';
import { expect, test } from './fixtures';

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

/** JF14: the planner sits behind the "payoff" disclosure on /loan; open it after every load. */
const openPlanner = (page: Page) => page.getByTestId('payoff-disclosure-summary').click();
const planner = (page: Page) => page.getByRole('region', { name: loan.planner.title, exact: true });
const comparison = (page: Page) => planner(page).getByRole('table', { name: loan.planner.compare.caption });
/** The cells of one row of the comparison: avalanche, snowball, minimums only. */
const row = (page: Page, label: string): Locator =>
  comparison(page).getByRole('row', { name: new RegExp(`^${label}`) }).getByRole('cell');
const extraSlider = (page: Page) => planner(page).getByRole('slider', { name: loan.planner.extra.label, exact: true });
const methodLabel = (page: Page, name: string) => planner(page).locator('label').filter({ hasText: new RegExp(`^${name}$`) });

/** 'YYYY-MM' for the month `n` months after this one, in the browser's own calendar (the planner's "today"). */
function monthsFromNow(n: number): string {
  const d = new Date();
  const when = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe('S12 Loan Lab: debt payoff planner', () => {
  test('shows avalanche, snowball and minimums only side by side; moving the extra moves the debt-free date', async ({ page }) => {
    await page.goto('/loan');
    await openPlanner(page);
    await expect(planner(page)).toBeVisible();
    await expect(comparison(page)).toBeVisible();
    // The old single-method card is gone: the planner took its place.
    await expect(page.getByRole('heading', { name: loan.payoffOrder.title })).toHaveCount(0);

    const heads = comparison(page).getByRole('columnheader');
    await expect(heads.nth(1)).toContainText(loan.planner.method.names.avalanche);
    await expect(heads.nth(2)).toContainText(loan.planner.method.names.snowball);
    await expect(heads.nth(3)).toContainText(loan.planner.method.names.minimum);
    for (const label of [loan.planner.compare.rows.debtFree, loan.planner.compare.rows.interest, loan.planner.compare.rows.months]) {
      await expect(row(page, label)).toHaveCount(3);
    }

    // It opens at a suggested extra worked out from the demo profile (half of the $75.80 a month left once offer A's
    // payment is in, in $25 steps: $25), so the methods already differ from minimums only, and it says where the $25
    // came from. Dates are "March 2030": a month and a year.
    await expect(extraSlider(page)).toHaveValue('25');
    await expect(planner(page).getByTestId('payoff-extra-suggested')).toHaveText(loan.planner.extra.suggested.share('50%', '$76'));
    const debtFree = row(page, loan.planner.compare.rows.debtFree);
    await expect(debtFree.nth(2)).toHaveText(/^[A-Z][a-z]+ \d{4}$/);
    const minimums = (await debtFree.nth(2).textContent())!;
    await expect(debtFree.nth(0)).not.toHaveText(minimums);
    await expect(page.getByTestId('payoff-savings')).toContainText('less interest');
    // On the demo debts avalanche and snowball are the same plan (the card is both the highest rate and the smallest
    // balance, then the car loan, then the new loan); the screen says so rather than leaving it to look like a bug.
    await expect(debtFree.nth(1)).toHaveText((await debtFree.nth(0).textContent())!);
    await expect(planner(page).getByTestId('payoff-tie')).toHaveText(loan.planner.tie.sameOrder);

    // At $0 all three end the same month, and one line says why in place of a "the same" comparison.
    await extraSlider(page).fill('0');
    await expect(debtFree.nth(0)).toHaveText(minimums);
    await expect(debtFree.nth(1)).toHaveText(minimums);
    await expect(planner(page).getByTestId('payoff-tie')).toHaveText(loan.planner.tie.noExtra);
    await expect(page.getByTestId('payoff-savings')).toHaveCount(0);
    await expect(planner(page).getByTestId('payoff-extra-suggested')).toHaveCount(0);

    // Move the planner's own extra: the picked method gets there sooner, the minimums do not move.
    await extraSlider(page).fill('500');
    await expect(debtFree.nth(0)).not.toHaveText(minimums);
    await expect(debtFree.nth(2)).toHaveText(minimums);
    await expect(page.getByTestId('payoff-savings')).toContainText('less interest');
    await expect(page.getByTestId('payoff-savings')).toContainText('sooner');

    // The extra on the selected offer (the slider above) is a different control and did not move.
    await expect(page.getByTestId('extra-payoff')).toHaveText(loan.extra.payoffMonths(36));
    await expectNoHorizontalScroll(page);
  });

  test('keeps the method and the extra after a reload, in this browser only', async ({ page }) => {
    await page.goto('/loan');
    await openPlanner(page);
    await expect(planner(page)).toBeVisible();
    await extraSlider(page).fill('500');
    await methodLabel(page, loan.planner.method.names.snowball).click();
    await expect(planner(page).getByRole('radio', { name: loan.planner.method.names.snowball })).toBeChecked();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? '{}').state?.tools?.payoff))
      .toMatchObject({ method: 'snowball', extra: 500 });

    await page.reload();
    await openPlanner(page);
    await expect(planner(page)).toBeVisible();
    await expect(extraSlider(page)).toHaveValue('500');
    await expect(planner(page).getByRole('radio', { name: loan.planner.method.names.snowball })).toBeChecked();
  });

  test('keeps the suggested extra a suggestion when only the method was picked, and a picked $0 as $0', async ({ page }) => {
    await page.goto('/loan');
    await expect(extraSlider(page)).toHaveValue('25');
    await methodLabel(page, loan.planner.method.names.snowball).click();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? '{}').state?.tools?.payoff))
      .toEqual({ method: 'snowball' });

    await page.reload();
    await expect(planner(page).getByRole('radio', { name: loan.planner.method.names.snowball })).toBeChecked();
    await expect(extraSlider(page)).toHaveValue('25');
    await expect(planner(page).getByTestId('payoff-extra-suggested')).toBeVisible();

    await extraSlider(page).fill('0');
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? '{}').state?.tools?.payoff))
      .toEqual({ method: 'snowball', extra: 0 });
    await page.reload();
    await expect(extraSlider(page)).toHaveValue('0');
    await expect(planner(page).getByTestId('payoff-tie')).toHaveText(loan.planner.tie.noExtra);
  });

  test('says the total extra a month it takes to be debt-free by a chosen month, and when no extra is needed', async ({ page }) => {
    await page.goto('/loan');
    await openPlanner(page);
    const month = planner(page).getByLabel(loan.planner.target.label);
    const result = page.getByTestId('payoff-target-result');
    await expect(month).toBeVisible();

    // Two years out is sooner than the minimums get there: it takes a total extra.
    await month.fill(monthsFromNow(24));
    await expect(result).toContainText(/a total extra of \$[\d,]+ a month/);

    // Eight years out is later than the minimums' own end date: no extra is needed.
    await month.fill(monthsFromNow(96));
    await expect(result).toContainText('on track');

    // This month is not a target.
    await month.fill(monthsFromNow(0));
    await expect(planner(page).getByText(loan.planner.target.past)).toBeVisible();
  });

  test('is hidden in streamer mode: no figures from the planner', async ({ page }) => {
    await page.goto('/loan?stream=1');
    await openPlanner(page);
    await expect(planner(page)).toBeVisible();
    await expect(planner(page).getByText(loan.planner.hidden)).toBeVisible();
    await expect(comparison(page)).toHaveCount(0);
    await expect(planner(page)).not.toContainText(/\$\d/);
  });
});
