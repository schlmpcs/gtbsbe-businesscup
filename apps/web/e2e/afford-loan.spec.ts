// S11 Can I Afford It? and S12 Loan Lab on the demo profile (fixtures), phone + desktop.
import { expect, test, type Page } from '@playwright/test';
import { afford } from '../src/copy/afford';
import { loan } from '../src/copy/loan';

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

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test.describe('S11 Can I Afford It?', () => {
  test('a $300 cash purchase fits; a $15,000 card purchase is a no with a reason', async ({ page }) => {
    await page.goto('/afford');
    await expect(page.getByRole('heading', { name: afford.form.title })).toBeVisible();

    const price = page.getByRole('textbox', { name: afford.form.amount });
    await price.fill('300');
    const verdict = page.getByTestId('afford-verdict');
    await expect(verdict).toHaveAttribute('data-verdict', 'fits');
    await expect(verdict).toHaveText(afford.result.verdicts.fits);
    await expect(page.getByRole('figure', { name: afford.result.chartTitle(afford.defaultPurchaseLabel) })).toBeVisible();

    await price.fill('15000');
    await page.locator('label').filter({ hasText: new RegExp(`^${afford.form.payWithOptions.card}$`) }).click();
    await expect(verdict).toHaveAttribute('data-verdict', 'no');
    await expect(verdict).toHaveText(afford.result.verdicts.no);
    await expect(page.getByText(afford.result.failsOn.cushion(afford.result.cushionMonths(1)))).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('S12 Loan Lab', () => {
  test('shows 3 offers side by side; the extra-payment slider shortens the payoff', async ({ page }) => {
    await page.goto('/loan');
    const table = page.getByRole('table', { name: loan.compare.caption });
    await expect(table).toBeVisible();
    for (const n of [1, 2, 3]) {
      await expect(table.getByRole('button', { name: loan.compare.select(loan.offerName(n)) })).toBeVisible();
    }
    await expect(page.getByRole('meter')).toHaveCount(2);

    await page.getByTestId('extra-disclosure-summary').click(); // JF16: behind a disclosure
    const payoff = page.getByTestId('extra-payoff');
    await expect(payoff).toHaveText(loan.extra.payoffMonths(36));
    await page.getByRole('slider', { name: loan.extra.slider(loan.offerName(1)) }).fill('200');
    await expect(payoff).not.toHaveText(loan.extra.payoffMonths(36));
    // In the offer's own result: the payoff planner further down has its own "sooner" (it opens at a suggested extra).
    await expect(page.getByTestId('extra-result').getByText(/ sooner$/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
