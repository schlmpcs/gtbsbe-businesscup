// What if? (/what-if) on the sample profile, phone + desktop. No API key in e2e: the typed
// what-if is read by the rules reader on the server.
import { expect, test } from '@playwright/test';
import { whatIf } from '../src/copy/whatIf';

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

test('pick the car preset, see both end values and who is ahead; type a baby and see the chart change', async ({ page }) => {
  await page.goto('/what-if');
  await expect(page.getByRole('heading', { level: 1, name: whatIf.pageTitle })).toBeVisible();

  await page.getByRole('button', { name: whatIf.presets.car }).click();
  await expect(page.getByRole('button', { name: whatIf.presets.car })).toHaveAttribute('aria-pressed', 'true');
  const endA = page.getByTestId('end-A');
  const endB = page.getByTestId('end-B');
  await expect(endA).toHaveText(/^\$[\d,]+$/);
  await expect(endB).toHaveText(/^\$[\d,]+$/);
  await expect(page.getByTestId('what-if-ahead')).toHaveText(/^B leaves you \$[\d,]+ ahead in \d{4}\.$/);
  await expect(page.getByRole('figure', { name: whatIf.chart.title })).toBeVisible();
  await expect(page.getByText(whatIf.chart.range)).toBeVisible();
  const before = await endB.textContent();

  await page.getByRole('textbox', { name: whatIf.ask.label }).fill('we have a baby next year');
  await page.getByRole('button', { name: whatIf.ask.submit }).click();
  const confirm = page.getByTestId('what-if-confirm');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('Baby in 1 year');
  await expect(endB).toHaveText(before!); // nothing applies before confirming
  await confirm.getByRole('button', { name: whatIf.ask.putIn('B') }).click();

  await expect(page.getByTestId('choice-B')).toContainText('Baby in 1 year');
  await expect(endB).not.toHaveText(before!);
  await expect(page.getByTestId('what-if-ahead')).toHaveText(/^A leaves you \$[\d,]+ ahead in \d{4}\.$/);
  await expect(page.getByText(whatIf.chart.starts('B'))).toBeVisible();

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});
