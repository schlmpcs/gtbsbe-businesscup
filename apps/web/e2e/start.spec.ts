// /start: onboarding without typing (phone + desktop projects). A generated statement and the
// simulated bank connection both go through the real reader and categorizer to a reviewed month.
import { expect, test, type Page } from '@playwright/test';
import { start as t } from '../src/copy/start';

let pageErrors: string[] = [];
test.beforeEach(({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => { if (new URL(page.url()).pathname === '/start') pageErrors.push(err.message); });
  page.on('console', (msg) => { if (msg.type() === 'error' && new URL(page.url()).pathname === '/start') pageErrors.push(msg.text()); });
});
test.afterEach(() => expect(pageErrors, pageErrors.join('\n')).toEqual([]));

async function noSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test('generate a life → read it → guess → the measured month → the plan', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/start');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.choose.title);
  await noSideScroll(page);

  await page.getByTestId('start-generate').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.generate.title);
  await page.getByRole('group', { name: t.generate.household }).getByRole('button', { name: t.generate.households.solo }).click();
  await expect(page.getByText(t.generate.previewChildcare)).toHaveCount(0); // no kid, no childcare line
  await noSideScroll(page);
  await page.getByTestId('generate-statement').click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.reading.title.generated);
  await expect(page.getByText(t.reading.leavesTitle)).toBeVisible();
  await expect(page.getByText(/^Reading \d+ lines in this browser$/)).toBeVisible();
  await page.getByTestId('lock-guess').click();

  const total = page.getByTestId('reveal-total');
  await expect(total).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(t.reveal.actual)).toBeVisible();
  await expect(page.getByText(t.reveal.payIn)).toBeVisible();
  await expect(page.getByRole('list', { name: t.reveal.breakdownLabel })).toContainText('Rent + utilities');
  await noSideScroll(page);

  await page.getByTestId('start-finish').click();
  await expect(page).toHaveURL(/\/future$/);
});

test('connect a (simulated) bank: pick → share → linking → the account is read and reviewed', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/start');
  await page.getByTestId('start-connect').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.connect.pickTitle);
  await expect(page.getByText(t.connect.demoNote)).toBeVisible(); // labeled as simulated
  await noSideScroll(page);
  await page.getByTestId('bank-chase').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.connect.accountsTitle('Chase'));
  await expect(page.getByRole('textbox')).toHaveCount(0); // no login, no password
  await page.getByTestId('connect-share').click();
  await expect(page.getByText(t.connect.linking('Chase'))).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.reading.title.bank('Chase'), { timeout: 10_000 });
  await page.getByTestId('lock-guess').click();
  await expect(page.getByTestId('reveal-total')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(t.sourceLabel.bank)).toBeVisible();
  await noSideScroll(page);
});
