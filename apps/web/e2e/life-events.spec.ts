// Life events timeline (/tools/life-events): from the What if? hub, add a baby, see the 10-year delta
// and the per-event line, move it with the year select. Runs on the demo profile and the real area data.
import { expect, test, type Page } from '@playwright/test';
import { lifeEvents as t } from '../src/copy/lifeEvents';
import { tools } from '../src/copy/tools';

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}\n${err.stack ?? ''}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n\n')).toEqual([]);
});

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('life events: add a baby and see what it does in 10 years', async ({ page }) => {
  await page.goto('/tools');
  await page.getByRole('link', { name: new RegExp(tools.hub.items.lifeEvents.question.replace('?', '\\?')) }).click();
  await expect(page).toHaveURL(/\/tools\/life-events$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
  await expect(page.getByText(t.result.noEvents)).toBeVisible();

  await page.getByRole('button', { name: t.picker.add(t.kinds.baby) }).click();
  await expect(page.getByTestId('life-chip')).toHaveCount(1);
  const delta = page.getByTestId('life-delta');
  await expect(delta).toHaveText(/^−\$[\d,]+ in 10 years$/);
  const line = page.getByTestId('life-event-line');
  await expect(line).toContainText(/Baby in \d{4}: −\$[\d,]+\/mo/);
  await expect(line).toContainText('Childcare: −$');

  // A later baby costs less inside the 10 years.
  const before = await delta.textContent();
  await page.getByRole('combobox', { name: t.edit.year }).selectOption('6');
  await expect(delta).not.toHaveText(before ?? '');
  await expect(page.getByRole('figure').first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
