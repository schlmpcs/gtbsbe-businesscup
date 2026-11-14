import { expect, test } from '@playwright/test';

// The daily log: one typed line is read by the local parser (no AI), saved, and the month's
// numbers move; Home shows the same total and links back to /spend.
test('a typed line is saved and the spent total changes, on /spend and Home', async ({ page }) => {
  await page.goto('/spend');
  const input = page.getByRole('textbox', { name: 'Log spending' });
  await expect(input).toBeEnabled();
  const spent = page.getByTestId('spend-spent');
  await expect(spent).toHaveText('$0');
  const safeBefore = await page.getByTestId('spend-safe').textContent();

  await input.fill('coffee 5, taxi 18, groceries 64');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(spent).toHaveText('$87');
  await expect(page.getByTestId('spend-added')).toContainText('Added 3 purchases.');
  await expect(input).toHaveValue('');
  await expect(page.getByTestId('spend-days')).toContainText('taxi');
  await expect(page.getByTestId('spend-categories')).toContainText('Groceries');
  await expect(page.getByTestId('spend-safe')).not.toHaveText(safeBefore ?? '');

  // A preset chip (estimated price), then Undo takes it back out.
  await page.getByRole('button', { name: 'Add Coffee, $5 (estimate)' }).click();
  await expect(spent).toHaveText('$92');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(spent).toHaveText('$87');

  // Persisted: Home shows the same month so far and links to the log.
  await page.goto('/');
  const daily = page.getByTestId('today-daily');
  await expect(daily.getByTestId('today-daily-spent')).toHaveText('$87');
  await expect(daily.getByTestId('today-daily-safe')).toBeVisible();
  await expect(daily.getByRole('link', { name: /Open your daily log/ })).toHaveAttribute('href', '/spend');

  // The quick-add on Home adds to the same log.
  await daily.getByRole('textbox', { name: 'Log spending' }).fill('lunch 15');
  await daily.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(daily.getByTestId('today-daily-spent')).toHaveText('$102');
});
