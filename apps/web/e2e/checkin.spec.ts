// S14 Monthly check-in on the demo profile, phone + desktop: free users see one simulated month and
// the paywall card; after the jury promo code (prefilled on /pro) they can save it and see the history.
import { expect, test, type Page } from '@playwright/test';
import { checkin as c } from '../src/copy/checkin';
import { pro } from '../src/copy/pro';

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

test('fast-forwards a simulated month; Pro (promo code) saves it into the history', async ({ page }) => {
  await page.goto('/checkin');
  await expect(page.getByRole('heading', { level: 1, name: c.title })).toBeVisible();
  await expect(page.getByTestId('checkin-empty')).toBeVisible();

  // Free: one simulated month with forecast vs actual, and the paywall card instead of Save.
  await page.getByRole('button', { name: c.fastForward }).click();
  await expect(page.getByTestId('simulated-month').getByText(c.simulatedTag)).toBeVisible();
  await expect(page.getByTestId('checkin-compare')).toBeVisible();
  await expect(page.getByTestId('checkin-number-change')).not.toHaveText(c.number.before);
  await expect(page.getByRole('heading', { name: c.paywall.title })).toBeVisible();
  await expect(page.getByRole('button', { name: c.save })).toHaveCount(0);
  await expect(page.getByRole('button', { name: c.fastForward })).toBeDisabled();
  await expectNoHorizontalScroll(page);

  // The jury promo path.
  await page.getByRole('link', { name: c.paywall.cta }).click();
  await expect(page).toHaveURL(/\/pro/);
  await page.getByRole('button', { name: pro.promo.button }).click();
  await expect(page.getByRole('heading', { name: pro.active.successTitle })).toBeVisible();

  // Pro: fast-forward, save, and the month is in the history.
  await page.goto('/checkin');
  await expect(page.getByTestId('checkin-history')).toBeVisible();
  await expect(page.getByTestId('checkin-history-row')).toHaveCount(0);
  await page.getByRole('button', { name: c.fastForward }).click();
  await expect(page.getByTestId('simulated-month').getByText(c.simulatedTag)).toBeVisible();
  const monthLabel = (await page.getByTestId('simulated-month').locator('span').first().textContent()) ?? '';
  await page.getByRole('button', { name: c.save }).click();
  await expect(page.getByTestId('checkin-history-row')).toHaveCount(1);
  await expect(page.getByTestId('checkin-history-row').first()).toContainText(monthLabel);
  await expect(page.getByTestId('checkin-value')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: c.saved(monthLabel) })).toBeVisible();

  // The next month continues from the saved one; saving it adds a second row.
  await page.getByRole('button', { name: c.fastForward }).click();
  await page.getByRole('button', { name: c.save }).click();
  await expect(page.getByTestId('checkin-history-row')).toHaveCount(2);

  // Saved check-ins survive a reload (this browser's store).
  await page.reload();
  await expect(page.getByTestId('checkin-history-row')).toHaveCount(2);
  await expectNoHorizontalScroll(page);

  // The calendar reminder is a real .ics file.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: c.calendar.button }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('monthly-check-in.ics');
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const ics = Buffer.concat(chunks).toString('utf8');
  expect(ics).toContain('BEGIN:VEVENT');
  expect(ics).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=1');
});
