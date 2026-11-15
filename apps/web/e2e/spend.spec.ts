import { expect, test } from '@playwright/test';

// The daily log: one typed line is read by the local parser (no AI), saved, and the month's
// numbers move; Home shows the same total and links back to /spend.
test('a typed line is saved and the spent total changes, on /spend and Home', async ({ page }) => {
  await page.goto('/spend');
  const input = page.getByRole('textbox', { name: 'Log spending' });
  await expect(input).toBeEnabled();
  const spent = page.getByTestId('spend-spent');
  await expect(spent).toHaveText('$0');
  await expect(page.getByTestId('spend-empty')).toBeVisible();
  await expect(page.getByTestId('spend-chart')).toBeVisible();
  await expect(page.getByTestId('back-to-tools')).toBeVisible();
  await expect(page.getByRole('link', { name: /Back to Home/ })).toHaveCount(0);
  await page.waitForTimeout(800); // let the count-up settle
  const safeBefore = await page.getByTestId('spend-safe').textContent();

  await input.fill('coffee 5, taxi 18, groceries 64');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(spent).toHaveText('$87');
  await expect(page.getByTestId('spend-added')).toContainText('Added 3 purchases.');
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('spend-days')).toContainText('taxi');
  await expect(page.getByTestId('spend-categories')).toContainText('Groceries');
  await expect(page.getByTestId('spend-safe')).not.toHaveText(safeBefore ?? '');
  await expect(page.getByTestId('spend-empty')).toHaveCount(0);

  // Phones: nothing scrolls sideways.
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

  // A preset chip (estimated price), then Undo takes it back out.
  await page.getByRole('button', { name: 'Add Coffee, $5 (typical price)' }).click();
  await expect(spent).toHaveText('$92');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(spent).toHaveText('$87');

  // Persisted: the log survives a reload.
  await page.reload();
  await expect(page.getByTestId('spend-spent')).toHaveText('$87');
});
