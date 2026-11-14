// UI kit showcase (/kit): every primitive renders and the interactive ones respond in a real browser.
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';
import { kitShowcase as t } from '../src/copy/kitShowcase';

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
  await page.goto('/kit');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

test('renders every primitive section', async ({ page }) => {
  for (const name of Object.values(t.sections)) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  // The chart library drew an SVG with a line and a band.
  const chart = page.getByRole('figure', { name: t.chart.title });
  await expect(chart.locator('.recharts-surface')).toBeVisible();
  await expect(chart.locator('.recharts-line-curve').first()).toBeVisible();
  await expect(chart.locator('.recharts-area-area').first()).toBeVisible();
  await expect(page.getByRole('meter', { name: t.gauge.label })).toBeVisible();
  await expect(page.getByText(common.estimateTag).first()).toBeVisible();
});

test('slider moves with the keyboard and its label follows', async ({ page }) => {
  const slider = page.getByRole('slider', { name: t.sliders.rent });
  await expect(slider).toHaveAttribute('aria-valuetext', '$1,950');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '$2,000');
});

test('debt-load slider drives the gauge zone', async ({ page }) => {
  const slider = page.getByRole('slider', { name: t.sliders.debtLoad });
  const meter = page.getByRole('meter', { name: t.gauge.label });
  await slider.fill('0.5');
  await expect(meter).toHaveAttribute('aria-valuetext', `50%, ${common.kit.gaugeZones.high}`);
  await slider.fill('0.1');
  await expect(meter).toHaveAttribute('aria-valuetext', `10%, ${common.kit.gaugeZones.low}`);
});

test('tabs switch on click and with arrow keys', async ({ page }) => {
  const second = page.getByRole('tab', { name: t.tabs.offer(2) });
  await second.click();
  await expect(second).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: t.tabs.offer(3) })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: t.tabs.offer(3) })).toBeVisible();
});

test('sheet opens, closes with Esc, and returns focus', async ({ page }) => {
  const opener = page.getByRole('button', { name: t.sheet.open });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: t.sheet.title });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('number input formats at rest and stores rates as decimals', async ({ page }) => {
  const amount = page.getByRole('textbox', { name: t.inputs.amount });
  await expect(amount).toHaveValue('28,000');
  const apr = page.getByRole('textbox', { name: t.inputs.apr });
  await expect(apr).toHaveValue('6.9');
});

test('nothing on the page scrolls sideways', async ({ page }) => {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
});

test('the kit page is not linked from the home nav', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/kit"]')).toHaveCount(0);
});
