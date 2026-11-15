import { expect, test } from '@playwright/test';

// P8 /plan, P9 ?view=compare, P10 ?view=chance on the engine (demo profile and demo scenarios).
test.describe('/plan', () => {
  test('shows the rules-based KPIs, the chart and Next Moves; adds an event', async ({ page }) => {
    await page.goto('/plan');
    await expect(page.getByRole('heading', { level: 1, name: 'Your plan' })).toBeVisible();
    await expect(page.locator('[data-kpi]')).toHaveCount(4);
    await expect(page.locator('[data-kpi]').first().getByText('Rules-based')).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Net worth by age' })).toBeVisible();
    await expect(page.locator('[data-move]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Add event' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Have a kid/ }).click();
    await expect(page.getByRole('dialog').getByText('Childcare per month')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: 'Edit Have a kid' })).toBeVisible();
  });

  test('Compare and Chance of success views live in the URL', async ({ page }) => {
    await page.goto('/plan?view=compare');
    await expect(page.getByTestId('compare-sentence')).toBeVisible();
    await expect(page.locator('[data-diff]')).toHaveCount(3);

    await page.getByRole('button', { name: 'Chance of success' }).click();
    await expect(page).toHaveURL(/view=chance/);
    await page.getByRole('button', { name: 'Run simulation' }).click();
    await expect(page.getByTestId('chance-pct')).toHaveText(/%$/);
    await expect(page.getByRole('meter')).toBeVisible();
  });

  test('fits a 390px phone without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const url of ['/plan', '/plan?view=compare', '/plan?view=chance']) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
  });
});
