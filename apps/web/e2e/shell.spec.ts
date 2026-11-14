// The app shell (MP14): sidebar on desktop, bottom tabs + More on a phone; the sample banner only
// where the numbers on screen are the sample's.
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';

const t = common.shell;

test('navigation: every page is reachable on this viewport, with the current page marked', async ({ page, isMobile }) => {
  await page.goto('/tools');
  if (isMobile) {
    const tabs = page.getByRole('navigation', { name: t.tabsLabel });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole('link', { name: t.links.whatIf })).toHaveAttribute('aria-current', 'page');
    await tabs.getByRole('button', { name: t.more }).click();
    const more = page.getByRole('navigation', { name: t.moreLabel });
    for (const key of ['accounts', 'transactions', 'cashflow', 'budget', 'recurring', 'goals', 'future', 'pro'] as const) {
      await expect(more.getByRole('link', { name: t.links[key], exact: true })).toBeVisible();
    }
    await more.getByRole('link', { name: t.links.future, exact: true }).click();
    await expect(page).toHaveURL(/\/future$/);
    await expect(page.getByRole('navigation', { name: t.moreLabel })).toHaveCount(0);
    // Nothing hides under the fixed tab bar: the disclaimer at the very bottom scrolls clear of it.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const disclaimer = await page.getByText(common.disclaimer, { exact: true }).boundingBox();
    const bar = await tabs.boundingBox();
    expect(disclaimer!.y + disclaimer!.height).toBeLessThanOrEqual(bar!.y + 1);
  } else {
    const side = page.getByRole('navigation', { name: t.sidebarLabel });
    await expect(side).toBeVisible();
    await expect(side.getByRole('link', { name: t.links.whatIf })).toHaveAttribute('aria-current', 'page');
    for (const key of ['home', 'plan', 'accounts', 'transactions', 'cashflow', 'budget', 'recurring', 'goals', 'future', 'play'] as const) {
      await expect(side.getByRole('link', { name: t.links[key], exact: true })).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: t.tabsLabel })).toBeHidden();
  }
});

test('sample banner: on numbers screens while the profile is the sample, never on the game, Pro or the hub', async ({ page }) => {
  // No sample asked for, nothing entered: /future still shows the starting profile, so it says so.
  await page.goto('/future');
  await expect(page.getByTestId('sample-banner')).toContainText(common.sampleBanner.textDefault);

  await page.goto('/future?sample=1');
  await expect(page.getByTestId('sample-banner')).toContainText(common.sampleBanner.text);
  for (const route of ['/play', '/pro', '/tools']) {
    await page.goto(route);
    await expect(page.locator('main').first()).toBeVisible();
    await expect(page.getByTestId('sample-banner')).toHaveCount(0);
  }
  await page.goto('/future');
  await page.getByTestId('sample-banner').getByRole('link', { name: common.sampleBanner.cta }).click();
  await expect(page).toHaveURL(/\/me\/guess$/);
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
});
