// Smoke test: the app builds, serves, and every screen route renders. T8 adds the demo-path spec.
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';
import { linkedScreenIds, SCREEN_ROUTES } from '../src/lib/screens';

test('home page loads with the disclaimer; /screens links every screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(common.disclaimer)).toBeVisible();
  await expect(page.locator('a[data-screen]')).toHaveCount(0); // no developer list on the landing (JF15)
  await page.goto('/screens');
  // Every screen but S4 (the slider's streamer mode) while /play is the duel.
  await expect(page.locator('nav a[data-screen]')).toHaveCount(linkedScreenIds().length);
});

for (const id of linkedScreenIds()) {
  const route = SCREEN_ROUTES[id];
  if (id === 'S3') continue; // S3 (Reveal) is a state of /play, reached after a pick
  test(`${id} renders at ${route}`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    // Every screen shows its title only, never an internal screen ID.
    await expect(h1).not.toHaveText(/\bS\d{1,2}\b/);
  });
}
