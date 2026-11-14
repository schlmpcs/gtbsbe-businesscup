// Smoke test: the app builds, serves, and every screen route renders (by direct navigation: the first
// visit no longer lists every screen).
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';
import { SCREEN_ROUTES } from '../src/lib/screens';

test('home page loads with the disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(common.disclaimer)).toBeVisible();
});

for (const [id, route] of Object.entries(SCREEN_ROUTES)) {
  if (id === 'S3') continue; // S3 (Reveal) is a state of /play, reached after a guess
  test(`${id} renders at ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    // Screens show their title only, never an internal screen ID.
    await expect(h1).not.toHaveText(/\bS\d{1,2}\b/);
  });
}
