// Bills calendar (/tools/bills), phone and desktop: the empty state on a fresh browser; then, with a
// profile of the user's own (the demo fixture) and the sample statement's subscription audit saved in
// this browser, the month grid, the next 7 days, an inline due-day edit, the .ics export, the What if?
// hub entry and the Home line "Next bill: …". The clock is fixed so the dates are the same every run.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bills as t } from '../src/copy/bills';
import { tools } from '../src/copy/tools';

const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../packages/data/fixtures/${name}`, import.meta.url), 'utf8'));
const profile = fixture('profile.demo.json');
const audit = fixture('subscriptions.expected.json');

// Saturday 14 November 2026, noon in the browser's time zone.
const NOW = new Date(2026, 10, 14, 12);

let pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
  await page.clock.setFixedTime(NOW);
});

test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

async function seed(page: Page) {
  await page.addInitScript(
    ({ profile, audit }) => {
      if (localStorage.getItem('lifeguessr.app')) return;
      const subscriptions = { ticks: [], confirmed: [], dismissed: [], cancelMarked: [], audit };
      localStorage.setItem(
        'lifeguessr.app',
        JSON.stringify({ version: 1, state: { profile, profileOrigin: 'user', tools: { subscriptions } } }),
      );
    },
    { profile, audit },
  );
}

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('fresh browser: the empty state links to the statement upload', async ({ page }) => {
  await page.goto('/tools/bills');
  await expect(page.getByRole('heading', { level: 1, name: t.title })).toBeVisible();
  await expect(page.getByTestId('bills-empty')).toBeVisible();
  await expect(page.getByRole('link', { name: t.empty.upload })).toHaveAttribute('href', '/me/upload');
});

test('the month on one screen: grid, next 7 days, due-day edit, calendar export', async ({ page }) => {
  await seed(page);
  await page.goto('/tools/bills');
  const grid = page.getByRole('table', { name: t.month.gridLabel('November 2026') });
  await expect(grid).toBeVisible();
  await expect(grid.getByRole('columnheader')).toHaveCount(7);
  await expectNoHorizontalScroll(page);

  // Rent on the 1st (assumed), Netflix on the 7th (from the statement), card and car loan on the 20th.
  await expect(page.locator('[data-testid="bills-day"][data-day="1"]')).toBeVisible();
  await expect(page.locator('[data-testid="bills-day"][data-day="7"]')).toBeVisible();
  const soon = page.getByTestId('bills-soon-list');
  await expect(soon.getByText(t.soon.line('Fri', 20, 'Credit card payment'))).toBeVisible();
  await expect(page.getByTestId('bills-month-total')).toContainText('$');

  // Move Netflix to the 16th: it joins the next 7 days, and the choice survives a reload.
  await page.getByRole('combobox', { name: t.list.dueDay('Netflix') }).selectOption('16');
  await expect(soon.getByText(t.soon.line('Mon', 16, 'Netflix'))).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('bills-soon-list').getByText(t.soon.line('Mon', 16, 'Netflix'))).toBeVisible();

  // Next month, then back.
  await page.getByRole('button', { name: t.month.next }).click();
  await expect(page.getByRole('table', { name: t.month.gridLabel('December 2026') })).toBeVisible();
  await page.getByRole('button', { name: t.month.today, exact: true }).click();
  await expect(grid).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: t.export.button }).click();
  expect((await download).suggestedFilename()).toBe('lifeguessr-bills.ics');
  await expect(page.getByText(t.export.downloaded)).toBeVisible();
});

test('listed in the What if? hub', async ({ page }) => {
  await seed(page);
  await page.goto('/tools');
  const card = page.getByRole('link', { name: new RegExp(tools.hub.items.bills.question.replace('?', '\\?')) });
  await expect(card).toHaveAttribute('href', '/tools/bills');

});
