import { expect, test } from '@playwright/test';

// P8 /plan, P9 ?view=compare, P10 ?view=chance on the engine (demo profile and demo scenarios).
test.describe('/plan', () => {
  test('shows the rules-based KPIs, the chart and Next Moves; adds an event', async ({ page }) => {
    await page.goto('/plan');
    await expect(page.getByRole('heading', { level: 1, name: 'Your plan' })).toBeVisible();
    await expect(page.locator('[data-kpi]')).toHaveCount(5);
    await expect(page.locator('[data-kpi]').first().getByText('Rules-based')).toBeVisible();
    await expect(page.getByRole('figure', { name: 'Net worth by age' })).toBeVisible();
    await expect(page.locator('[data-move]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Add event' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Have a kid/ }).click();
    await expect(page.getByRole('dialog').getByText('Childcare per month')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await page.getByRole('tab', { name: 'Events' }).click();
    await expect(page.getByRole('button', { name: 'Edit Have a kid' })).toBeVisible();
  });

  test('event badges on the chart open the editor; the year table scrolls inside its card', async ({ page }) => {
    await page.goto('/plan');
    await page.getByRole('button', { name: /^Buy a home, 2032/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('region', { name: 'Accounts' }).getByRole('columnheader', { name: /2040/ })).toBeAttached();
    await expect(page.getByRole('link', { name: /Can I afford it\?/ })).toHaveAttribute('href', '/afford');
    await expect(page.getByRole('link', { name: /Which loan costs less\?/ })).toHaveAttribute('href', '/loan');
  });

  test('Assumptions open as a sheet on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/plan');
    await page.getByRole('button', { name: 'Assumptions' }).click();
    await expect(page.getByRole('dialog', { name: 'Assumptions' }).getByRole('slider', { name: /Inflation per year/ })).toBeVisible();
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
    await expect(page.locator('[data-histogram]')).toHaveCount(3);
    await page.getByRole('button', { name: 'Range' }).click();
    await expect(page.getByRole('figure', { name: 'Range of outcomes' })).toBeVisible();
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
