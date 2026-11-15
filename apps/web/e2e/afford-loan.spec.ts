// S11 Can I Afford It? and S12 Loan Lab on the demo profile (fixtures), phone + desktop.
import { expect, test, type Page } from '@playwright/test';
import { afford } from '../src/copy/afford';
import { loan } from '../src/copy/loan';
import { plan as planCopy } from '../src/copy/plan';
import { toolPlan } from '../src/copy/toolPlan';

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
  test('a $300 cash purchase fits (stretched: the demo keeps ~1 month of cash); a $15,000 card purchase is not yet', async ({ page }) => {
    await page.goto('/afford');
    await expect(page.getByRole('heading', { name: afford.form.title })).toBeVisible();

    const price = page.getByRole('textbox', { name: afford.form.amount });
    await price.fill('300');
    const verdict = page.getByTestId('afford-verdict');
    await expect(verdict).toHaveAttribute('data-verdict', 'fits');
    await expect(verdict).toHaveAttribute('data-tier', 'stretched');
    await expect(verdict).toHaveText(afford.result.tiers.stretched);
    await expect(page.getByTestId('afford-kpis')).toBeVisible();
    await expect(page.getByRole('figure', { name: afford.result.chartTitle(afford.defaultPurchaseLabel) })).toBeVisible();

    await price.fill('15000');
    await page.locator('label').filter({ hasText: new RegExp(`^${afford.form.payWithOptions.card}$`) }).click();
    await expect(verdict).toHaveAttribute('data-verdict', 'no');
    await expect(verdict).toHaveText(afford.result.tiers.notYet);
    await expect(page.getByText(afford.result.failsOn.cushion(afford.result.cushionMonths(1)))).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('"Add to my plan" puts the purchase on /plan as an event', async ({ page }) => {
    await page.goto('/afford');
    await page.getByRole('textbox', { name: afford.form.label }).fill('Couch');
    await page.getByRole('textbox', { name: afford.form.amount }).fill('2400');
    const card = page.getByTestId('tool-plan-impact');
    await expect(card.getByText(toolPlan.title)).toBeVisible();
    await card.getByRole('button', { name: toolPlan.add }).click();
    await expect(card.getByTestId('tool-plan-added')).toHaveText(new RegExp(toolPlan.added));
    await expectNoHorizontalScroll(page);
    await card.getByRole('link', { name: new RegExp(toolPlan.open) }).click(); // client-side: the plan store stays
    await expect(page).toHaveURL(/\/plan$/);
    await page.getByRole('tab', { name: planCopy.screen.tabs.events }).click();
    await expect(page.getByRole('button', { name: planCopy.screen.events.edit('Couch') })).toBeVisible();
    // The plan is saved in this browser: a reload keeps the event.
    await page.reload();
    await page.getByRole('tab', { name: planCopy.screen.tabs.events }).click();
    await expect(page.getByRole('button', { name: planCopy.screen.events.edit('Couch') })).toBeVisible();
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

    await expect(page.getByTestId('loan-verdict-headline')).toHaveText(loan.verdict.saves(loan.offerName(1), loan.offerName(2), '$1,134'));
    await expect(page.getByTestId('loan-cost-race')).toBeVisible();
    await expect(page.getByRole('figure', { name: loan.balance.title(loan.offerName(1)) })).toBeVisible();
    const payoff = page.getByTestId('extra-payoff');
    await expect(payoff).toHaveText(loan.extra.payoffMonths(36));
    await page.getByRole('slider', { name: loan.extra.slider(loan.offerName(1)) }).fill('200');
    await expect(payoff).not.toHaveText(loan.extra.payoffMonths(36));
    // In the offer's own result: the payoff planner further down has its own "sooner" (it opens at a suggested extra).
    await expect(page.getByTestId('extra-result').getByText(/ sooner$/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('"Add to my plan" adds the selected offer to /plan', async ({ page }) => {
    await page.goto('/loan');
    await page.getByRole('button', { name: loan.compare.select(loan.offerName(2)) }).click();
    const card = page.getByTestId('tool-plan-impact');
    await card.getByRole('button', { name: toolPlan.add }).click();
    await expect(card.getByTestId('tool-plan-added')).toBeVisible();
    await card.getByRole('link', { name: new RegExp(toolPlan.open) }).click();
    await expect(page).toHaveURL(/\/plan$/);
    await page.getByRole('tab', { name: planCopy.screen.tabs.events }).click();
    await expect(page.getByRole('button', { name: planCopy.screen.events.edit(loan.plan.eventName(loan.offerName(2))) })).toBeVisible();
    await page.reload();
    await page.getByRole('tab', { name: planCopy.screen.tabs.events }).click();
    await expect(page.getByRole('button', { name: planCopy.screen.events.edit(loan.plan.eventName(loan.offerName(2))) })).toBeVisible();
  });
});
