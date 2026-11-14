// S15 Pro: the simulated checkout unlocks Pro without Stripe or a card. The e2e server has no
// STRIPE_SECRET_KEY, so /pro offers the simulated checkout (view-model checkoutMode 'demo').
import { expect, test } from '@playwright/test';
import { pro as copy } from '../src/copy/pro';

test('paying in the simulated checkout unlocks Pro and says it is a demo', async ({ page }) => {
  await page.goto('/pro');
  await expect(page.getByText(copy.demoBadge.demo)).toBeVisible();
  await expect(page.getByText(copy.demoCheckout.card)).toBeVisible();
  // The only text field is the promo code: no card number to type.
  await expect(page.getByRole('textbox')).toHaveCount(1);

  await page.getByRole('button', { name: /Pay \$39\.99 \(demo\)/ }).click();

  await expect(page.getByRole('heading', { name: copy.active.successTitle })).toBeVisible();
  await expect(page.getByText(copy.active.sources.demo_checkout)).toBeVisible();

  // The server remembers it: a reload shows Pro, not the offer.
  await page.reload();
  await expect(page.getByRole('heading', { name: copy.active.title })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay \$/ })).toHaveCount(0);
});
