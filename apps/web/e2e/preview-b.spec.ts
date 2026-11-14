// Design previews of the tool screens (S20–S26): each route renders the banner and its heading.
import { expect, test } from '@playwright/test';
import { previewB as t } from '../src/copy/previewB';

const ROUTES = [
  ['/preview/tools', t.hub.title],
  ['/preview/tools/subscriptions', t.subs.title],
  ['/preview/tools/overpaying', t.overpaying.title],
  ['/preview/tools/payoff', t.payoff.title],
  ['/preview/tools/runway', t.runway.title],
  ['/preview/tools/yearly', t.yearly.title],
  ['/preview/tools/household', t.household.title],
] as const;

for (const [route, heading] of ROUTES) {
  test(`preview ${route} shows the banner and heading`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('note').filter({ hasText: t.banner })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  });
}

test('hub links open each tool preview', async ({ page }) => {
  await page.goto('/preview/tools');
  await page.getByRole('link', { name: new RegExp(t.hub.tools.overpaying.title) }).click();
  await expect(page).toHaveURL(/\/preview\/tools\/overpaying$/);
  await expect(page.getByRole('heading', { level: 1, name: t.overpaying.title })).toBeVisible();
});

test('little things steps switch locally', async ({ page }) => {
  await page.goto('/preview/tools/subscriptions');
  await expect(page.getByRole('heading', { name: t.subs.guessQuestion })).toBeVisible();
  await page.getByRole('button', { name: t.subs.showReal }).click();
  await expect(page.getByText(t.subs.maybeHeading)).toBeVisible();
  await page.getByRole('button', { name: t.subs.nextToDecide }).click();
  await expect(page.getByRole('button', { name: t.subs.addMoves })).toBeVisible();
});
