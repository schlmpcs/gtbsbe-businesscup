// S23 Overpaying check (/tools/overpaying): the cold path on the real area data, phone and desktop.
// Uses the tool harness (e2e/tools/fixtures.ts): a fresh browser with the saved state seeded to
// `tools: {}`, so nothing is prefilled and the visitor starts cold.
import { type Page } from '@playwright/test';
import { overpaying as t } from '../src/copy/overpaying';
import { expect, test } from './tools/fixtures';

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

const zipBox = (page: Page) => page.getByRole('textbox', { name: t.form.zip, exact: true });
const amountBox = (page: Page, line: keyof typeof t.lines) => page.getByRole('textbox', { name: t.lines[line], exact: true });
const rowOf = (page: Page, line: keyof typeof t.lines) => page.locator(`[data-testid="benchmark-row"][data-line="${line}"]`);

test.describe('S23 Overpaying check', () => {
  test('cold: a covered ZIP and a rent give a verdict with its source', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.screens.S23);
    await expect(page.getByTestId('needs')).toHaveText(t.needs.zip);

    await zipBox(page).fill('75206'); // Dallas-Fort Worth, in the data (2 bedrooms: $2,420, range about $1,921 to $3,065)
    await expect(page.getByTestId('needs')).toHaveText(t.needs.amount);
    await amountBox(page, 'rent').fill('6000'); // far above any 2-bedroom rent there

    const rent = rowOf(page, 'rent');
    await expect(rent).toHaveAttribute('data-position', 'above');
    await expect(rent.getByTestId('position')).toContainText(t.result.positions.above);
    await expect(rent.getByText(/^Source:/)).toBeVisible(); // the source note, with its year
    await expect(page.getByTestId('coverage')).toHaveAttribute('data-coverage', 'exact');
    await expect(page.getByTestId('overpaying-summary')).toContainText(t.result.summaryLine(1, 1));
    // Cold: no profile of the person's own, so no 10-year effect; the screen says what it needs.
    await expect(page.getByTestId('effect10y')).toHaveCount(0);
    await expect(page.getByTestId('overpaying-summary').getByRole('link', { name: t.result.effectNeedsProfileLink })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('says which household it compared against, and switches once the household is entered', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await zipBox(page).fill('75206');
    await amountBox(page, 'rent').fill('6000');
    const note = page.getByTestId('household-note');
    await expect(note).toHaveAttribute('data-household', 'default');
    await expect(note).toContainText('2 bedrooms, 1 adult, no children');
    await expect(note).toContainText('(default)');

    await page.getByRole('group', { name: t.form.adults, exact: true }).locator('label').filter({ hasText: /^2$/ }).click();
    await expect(note).toHaveAttribute('data-household', 'entered');
    await expect(note).toContainText('Based on the household you entered');
    await expect(note).toContainText('2 bedrooms, 2 adults, no children');
  });

  test('the last inputs are kept in the browser and come back after a reload', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await zipBox(page).fill('75206');
    await amountBox(page, 'rent').fill('6000');
    await expect(rowOf(page, 'rent')).toHaveAttribute('data-position', 'above');

    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? '{}').state?.tools?.overpaying))
      .toMatchObject({ zip: '75206', rent: 6000, bedrooms: 2, adults: 1, kids: [] });

    await page.reload();
    await expect(zipBox(page)).toHaveValue('75206');
    await expect(amountBox(page, 'rent')).toHaveValue('6,000');
    await expect(rowOf(page, 'rent')).toHaveAttribute('data-position', 'above');
  });

  test('a bad ZIP is said beside its box and nothing is compared', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await zipBox(page).fill('SW1A 1AA');
    await amountBox(page, 'rent').fill('1500');
    await expect(page.getByText(t.form.errors.zip)).toBeVisible();
    await expect(page.getByTestId('benchmark-row')).toHaveCount(0);
  });

  test('an uncovered ZIP offers the metro picker and an approximate result', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await zipBox(page).fill('99999'); // not in the data
    await amountBox(page, 'rent').fill('2000');
    const coverage = page.getByTestId('coverage');
    await expect(coverage).toHaveAttribute('data-coverage', 'none');
    await expect(coverage).toContainText(/We cover \d+ ZIP codes in \d+ metros/);
    await expect(page.getByTestId('benchmark-row')).toHaveCount(0);

    await page.getByRole('combobox', { name: t.picker.metro, exact: true }).selectOption({ label: 'Dallas-Fort Worth, TX' });
    await expect(page.getByRole('radio', { name: t.picker.tiers.mid })).toBeChecked();
    await expect(coverage).toHaveAttribute('data-coverage', 'metro');
    await expect(coverage).toContainText(t.coverage.approximate);
    const rent = rowOf(page, 'rent');
    await expect(rent).toBeVisible();
    await expect(rent.getByTestId('range-estimate')).toBeVisible(); // approximate: the estimate tag is on

    // Another uncovered ZIP asks again instead of reusing the metro.
    await zipBox(page).fill('12345');
    await expect(coverage).toHaveAttribute('data-coverage', 'none');
    await expect(page.getByTestId('benchmark-row')).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test('streamer mode hides the tool', async ({ page }) => {
    await page.goto('/tools/overpaying?stream=1');
    await expect(page.getByTestId('streamer-notice')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    // The duel has no streamer view, so the way back is the plain /play; only the slider game
    // (NEXT_PUBLIC_GAME_MODE=slider, the rollback) has `?stream=1`.
    const href = process.env.NEXT_PUBLIC_GAME_MODE === 'slider' ? '/play?stream=1' : '/play';
    await expect(page.getByRole('link', { name: t.streamer.back })).toHaveAttribute('href', href);
  });
});
