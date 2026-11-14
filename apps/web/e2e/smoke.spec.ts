// Smoke test: the app builds, serves, and every screen route renders. T8 adds the demo-path spec.
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';
import { SCREEN_ROUTES } from '../src/lib/screens';

test('home page loads with the disclaimer and a link to every screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(common.disclaimer)).toBeVisible();
  await expect(page.locator('nav a[data-screen]')).toHaveCount(Object.keys(SCREEN_ROUTES).length);
});

for (const [id, route] of Object.entries(SCREEN_ROUTES)) {
  if (id === 'S3') continue; // S3 (Reveal) is a state of /play, reached after a guess
  test(`${id} renders at ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    // Placeholder screens put the ID in the heading; real screens just need one.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
}
