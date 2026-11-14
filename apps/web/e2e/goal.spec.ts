import { expect, test } from '@playwright/test';
test('a rules-based goal persists through reload and can be cleared', async ({
  page,
}) => {
  await page.goto('/future');
  await page.getByTestId('goal-disclosure').locator('summary').click(); // JF16: behind a disclosure
  const card = page.getByTestId('goal-card');
  await card.getByRole('button', { name: 'Set goal', exact: true }).click();
  await expect(card.getByTestId('goal-verdict')).toHaveText(
    /^(On track|Within range|Behind)$/,
  );
  await expect(card.getByRole('progressbar')).toBeVisible();
  await page.reload();
  await page.getByTestId('goal-disclosure').locator('summary').click(); // JF16: behind a disclosure
  await expect(card.getByRole('button', { name: 'Clear goal' })).toBeVisible();
  await card.getByRole('button', { name: 'Clear goal' }).click();
  await expect(
    card.getByRole('button', { name: 'Set goal', exact: true }),
  ).toBeVisible();
});
