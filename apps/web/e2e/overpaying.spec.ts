// S23 Overpaying check (/tools/overpaying): the cold path on the real area data, phone and desktop.
import { expect, test, type Page } from '@playwright/test';
import { overpaying as t } from '../src/copy/overpaying';

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

test.describe('S23 Overpaying check', () => {
  // Needs the engine's overpayingCheck bound in features/overpaying/model/deps.ts (issue #86). Until then
  // the page says the comparison is not available yet. Remove `.fixme` when it is wired.
  test.fixme('cold: a covered ZIP and a rent give a verdict with its source', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.screens.S23);
    await expect(page.getByText(t.needs.zip)).toBeVisible();

    await page.getByRole('textbox', { name: t.form.zip }).fill('75206'); // Dallas-Fort Worth, in the data
    await page.getByRole('textbox', { name: t.lines.rent }).fill('6000'); // far above any 2-bedroom rent there

    const rent = page.getByTestId('benchmark-row').filter({ has: page.getByRole('heading', { name: t.lines.rent }) });
    await expect(rent).toHaveAttribute('data-position', 'above');
    await expect(rent.getByText(t.result.positions.above)).toBeVisible();
    await expect(rent.getByText(/^Source:/)).toBeVisible();
    await expect(page.getByTestId('overpaying-summary')).toContainText(t.result.summaryLine(1, 1));
    await expectNoHorizontalScroll(page);
  });

  test.fixme('an uncovered ZIP offers the metro picker and an approximate result', async ({ page }) => {
    await page.goto('/tools/overpaying');
    await page.getByRole('textbox', { name: t.form.zip }).fill('99999');
    await page.getByRole('textbox', { name: t.lines.rent }).fill('2000');
    await expect(page.getByTestId('coverage')).toHaveAttribute('data-coverage', 'none');
    await page.getByRole('combobox', { name: t.picker.metro }).selectOption({ index: 1 });
    await expect(page.getByTestId('coverage')).toHaveAttribute('data-coverage', 'metro');
    await expect(page.getByText(t.coverage.approximate)).toBeVisible();
    await expect(page.getByTestId('benchmark-row').first()).toBeVisible();
  });

  test('streamer mode hides the tool', async ({ page }) => {
    await page.goto('/tools/overpaying?stream=1');
    await expect(page.getByTestId('streamer-notice')).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('link', { name: t.streamer.back })).toHaveAttribute('href', '/play?stream=1');
  });
});
