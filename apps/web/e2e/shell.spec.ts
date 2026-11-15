// The app shell (MP14): sidebar on desktop, bottom tabs + More on a phone, no chrome on the landing and
// the onboarding story; the sample banner only where the numbers on screen are the sample's.
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';

const t = common.shell;

test('navigation: every page is reachable on this viewport, with the current page marked', async ({ page, isMobile }) => {
  await page.goto('/budget');
  if (isMobile) {
    const tabs = page.getByRole('navigation', { name: t.tabsLabel });
    await expect(tabs).toBeVisible();
    for (const key of ['dashboard', 'plan', 'play', 'accounts'] as const) {
      await expect(tabs.getByRole('link', { name: t.links[key], exact: true })).toBeVisible();
    }
    await expect(tabs.getByRole('button', { name: t.more })).toBeVisible();
    await tabs.getByRole('button', { name: t.more }).click();
    const more = page.getByRole('navigation', { name: t.moreLabel });
    await expect(more.getByRole('link', { name: t.links.budget, exact: true })).toHaveAttribute('aria-current', 'page');
    for (const key of ['transactions', 'cashflow', 'budget', 'recurring', 'goals'] as const) {
      await expect(more.getByRole('link', { name: t.links[key], exact: true })).toBeVisible();
    }
    await expect(more.getByRole('link', { name: t.links.pro })).toBeVisible();
    await more.getByRole('link', { name: t.links.goals, exact: true }).click();
    await expect(page).toHaveURL(/\/goals$/);
    await expect(page.getByRole('navigation', { name: t.moreLabel })).toHaveCount(0);
    // Nothing hides under the fixed tab bar: the disclaimer at the very bottom scrolls clear of it.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const disclaimer = await page.getByText(common.disclaimer, { exact: true }).boundingBox();
    const bar = await tabs.boundingBox();
    expect(disclaimer!.y + disclaimer!.height).toBeLessThanOrEqual(bar!.y + 1);
    // No horizontal scroll at phone width.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } else {
    const side = page.getByRole('navigation', { name: t.sidebarLabel });
    await expect(side).toBeVisible();
    await expect(side.getByRole('link', { name: t.links.budget, exact: true })).toHaveAttribute('aria-current', 'page');
    for (const key of ['dashboard', 'plan', 'accounts', 'transactions', 'cashflow', 'recurring', 'goals', 'play'] as const) {
      await expect(side.getByRole('link', { name: t.links[key], exact: true })).toBeVisible();
    }
    await expect(side.getByText(t.groups.money)).toBeVisible();
    for (const gone of ['My future', 'What if?', 'Home']) {
      await expect(side.getByRole('link', { name: gone, exact: true })).toHaveCount(0);
    }
    await expect(page.getByTestId('shell-sidebar').getByText(t.proLine)).toBeVisible();
    await expect(page.getByRole('navigation', { name: t.tabsLabel })).toBeHidden();
  }
});

test('routes kept out of the nav still render inside the shell and light up their section', async ({ page, isMobile }) => {
  for (const [route, key] of [['/afford', 'plan'], ['/loan', 'plan']] as const) {
    await page.goto(route);
    const nav = page.getByRole('navigation', { name: isMobile ? t.tabsLabel : t.sidebarLabel });
    await expect(nav.getByRole('link', { name: t.links[key], exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.goto('/tools');
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.getByRole('navigation', { name: isMobile ? t.tabsLabel : t.sidebarLabel })).toBeVisible();
});

test('no chrome on the onboarding story: no sidebar, no tabs, no sample banner', async ({ page }) => {
  await page.goto('/me/guess');
  await expect(page.getByTestId('shell-bare')).toBeVisible();
  await expect(page.getByRole('navigation', { name: t.sidebarLabel })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: t.tabsLabel })).toHaveCount(0);
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
  await expect(page.getByText(common.disclaimer, { exact: true })).toBeVisible();
});

test('sample banner: on numbers screens while the profile is the sample, never on the game, Pro or the hub', async ({ page }) => {
  // No sample asked for, nothing entered: /plan and /future still show the starting profile, so they say so.
  await page.goto('/plan');
  await expect(page.getByTestId('sample-banner')).toContainText(common.sampleBanner.textDefault);
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
  await expect(page).toHaveURL(/\/start\?ch=2$/);
  await expect(page.getByTestId('sample-banner')).toHaveCount(0);
});
