// S13 Decision (the car) and S14 Monthly check-in on the demo profile and fixtures, phone + desktop.
import { expect, test, type Page } from '@playwright/test';
import { mocks } from '../src/copy/mocks';

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

const d = mocks.decision;
const c = mocks.checkin;

test.describe('S13 Decision: the car', () => {
  test('compares Path A and Path B with keeping the car; paying cash changes the path', async ({ page }) => {
    await page.goto('/decide');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${mocks.screens.S13}`));
    const table = page.getByRole('table', { name: d.compare.caption });
    await expect(table).toBeVisible();
    for (const id of ['A', 'B']) {
      await expect(page.getByTestId(`decision-verdict-${id}`)).toHaveAttribute('data-verdict', /^(fits|wait|no)$/);
    }
    await expect(page.getByTestId('decision-leader')).toHaveAttribute('data-leader', 'B');
    await expect(page.getByRole('figure', { name: d.chartTitle })).toBeVisible();

    await page.getByRole('tab', { name: d.pathName('B') }).click();
    const panelB = page.getByRole('tabpanel', { name: d.pathName('B') });
    await panelB.locator('label').filter({ hasText: new RegExp(`^${d.edit.payWithOptions.cash}$`) }).click();
    await expect(table.getByText(d.compare.noPayment)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('S14 Monthly check-in', () => {
  test('walks the month, commits to a move and finishes', async ({ page }) => {
    await page.goto('/checkin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${mocks.screens.S14}`));
    const month = page.getByTestId('checkin-month');
    await expect(month.getByRole('heading', { name: c.month.title('2026-10') })).toBeVisible();
    await expect(month.getByText(c.month.sampleNote)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole('button', { name: c.next }).click();
    const move = page.getByTestId('checkin-move');
    await move.getByRole('button', { name: new RegExp(`^${c.move.commit}`) }).first().click();
    await expect(move.getByText(c.move.committedLabel)).toBeVisible();
    await move.getByRole('button', { name: c.move.done }).click();
    await expect(move.getByRole('heading', { name: c.move.doneTitle })).toBeVisible();

    await page.getByRole('button', { name: c.next }).click();
    await expect(page.getByRole('figure', { name: c.future.chartTitle })).toBeVisible();
    await page.getByRole('button', { name: c.finish }).click();
    await expect(page.getByTestId('checkin-summary')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
