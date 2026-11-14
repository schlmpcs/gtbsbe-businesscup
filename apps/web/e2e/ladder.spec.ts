// Ladder S5–S9 (Y9, T6/T7): build a profile end to end in a real browser, on phone and desktop.
// closest life → sliders → balance sheet (add a debt) → /future, with the forecast updating.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { common } from '../src/copy/common';
import { forecast } from '../src/copy/forecast';
import { ladder } from '../src/copy/ladder';

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

const rung = (page: Page, screen: string) => page.locator(`[data-rung="${screen}"]`);
const SAMPLE_STATEMENT = fileURLToPath(new URL('../../../packages/data/fixtures/statement.sample.csv', import.meta.url));
const range = (page: Page) => page.getByTestId('ladder-range');

/** The saved app state (Zustand persist in localStorage). */
async function savedProfile(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('lifeguessr.app');
    return raw ? (JSON.parse(raw) as { state: { profile: { debts: { kind: string; apr: number; minPayment: { isEstimate: boolean } }[] }; profileOrigin: string; closestCardId: string | null } }).state : null;
  });
}

test('closest life → sliders → balance sheet with a new debt → /future', async ({ page }) => {
  // Against a deployment with a model key the last step may wait up to 25 s for the forecast on top of the
  // steps before it: three times the default timeout.
  test.slow();
  // S6: start from the first life.
  await page.goto('/me/closest');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ladder.screens.S6);
  const choose = page.getByRole('button', { name: new RegExp(`^${ladder.closest.choose}`) }).first();
  await choose.click();
  await expect(choose).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(ladder.closest.chosenNote)).toBeVisible();
  await expect(rung(page, 'S6')).toHaveAttribute('data-done', 'true');
  // A life card is all estimates: nothing narrowed yet.
  const narrowed = page.getByRole('progressbar', { name: ladder.shell.narrowedLabel });
  await expect(narrowed).toHaveAttribute('aria-valuenow', '0');
  expect((await savedProfile(page))?.profileOrigin).toBe('closestLife');

  // S7: through the "Next" CTA; move a slider and watch the month and the forecast change.
  await page.getByRole('link', { name: ladder.shell.next(ladder.screens.S7) }).click();
  await expect(page).toHaveURL(/\/me\/sliders$/);
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  const monthCost = page.getByTestId('month-cost');
  const costBefore = await monthCost.textContent();
  const rangeBefore = await range(page).textContent();
  const valueBefore = await eatingOut.getAttribute('aria-valuetext');
  await eatingOut.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(eatingOut).not.toHaveAttribute('aria-valuetext', valueBefore ?? '');
  await expect(monthCost).not.toHaveText(costBefore ?? '');
  await expect(range(page)).not.toHaveText(rangeBefore ?? '');
  await expect(rung(page, 'S7')).toHaveAttribute('data-done', 'true');
  await expect(narrowed).not.toHaveAttribute('aria-valuenow', '0');

  // S8: add a student loan; APR typed as a percent, saved as a decimal; minimum left empty.
  await page.getByRole('link', { name: ladder.shell.next(ladder.screens.S8) }).click();
  await expect(page).toHaveURL(/\/me\/balance$/);
  const debtLoad = page.getByRole('meter', { name: ladder.balance.debtLoadLabel });
  const loadBefore = await debtLoad.getAttribute('aria-valuenow');
  await page.getByRole('button', { name: ladder.balance.addDebt }).click();
  const form = page.getByRole('form', { name: ladder.balance.formTitleAdd });
  await form.getByLabel(ladder.balance.kindLabel).selectOption({ label: ladder.balance.debtKinds.student });
  await form.getByLabel(ladder.balance.balanceLabel).fill('20000');
  await form.getByLabel(ladder.balance.aprLabel).fill('5');
  await form.getByRole('button', { name: ladder.balance.save }).click();
  await expect(form).toBeHidden();
  const debts = page.getByRole('list', { name: ladder.balance.debtsLabel });
  const student = debts.locator('li', { hasText: ladder.balance.debtKinds.student });
  await expect(student).toContainText('$20,000');
  await expect(student).toContainText('5%');
  await expect(student.getByText(common.estimateTag).first()).toBeVisible(); // minimum payment estimated
  await expect(debtLoad).not.toHaveAttribute('aria-valuenow', loadBefore ?? '');
  await expect(rung(page, 'S8')).toHaveAttribute('data-done', 'true');
  const saved = await savedProfile(page);
  const loan = saved?.profile.debts.find((d) => d.kind === 'student');
  expect(loan?.apr).toBeCloseTo(0.05, 10);
  expect(loan?.minPayment.isEstimate).toBe(true);
  await expect(page.getByRole('progressbar', { name: ladder.shell.narrowedLabel })).toBeVisible();
  await expect(range(page)).toBeVisible();

  // S10: the CTA leads to the forecast of the profile built above. The ladder's number is the engine's
  // preview, labeled so. S10 shows the same number only while its own answer is the rules forecast (always
  // so in CI, where there is no model key); with the model's answer it shows another number, labeled as the AI's.
  const in10y = (await page.getByTestId('ladder-in10y').getByText(/^−?\$[\d,]+$/).textContent()) ?? '';
  expect(in10y).toMatch(/\$/);
  await expect(page.getByTestId('ladder-in10y-source')).toHaveText(forecast.source.rulesPreview);
  await page.getByRole('link', { name: ladder.shell.futureCta }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(forecast.future.title);
  const headlineSource = page.getByTestId('in10y').getByTestId('forecast-source');
  await expect(headlineSource).toBeVisible({ timeout: 30_000 }); // the model has up to 25 s before the rules answer
  if ((await headlineSource.getAttribute('data-source')) === 'rules') {
    await expect(headlineSource).toHaveText(forecast.source.rules);
    await expect(page.getByTestId('in10y')).toContainText(in10y);
  } else {
    await expect(headlineSource).toHaveText(forecast.source.ai);
  }
  await expect(page.getByRole('figure', { name: forecast.future.chartTitle }).locator('.recharts-line-curve').first()).toBeVisible();
  const after = await savedProfile(page);
  expect(after?.profile.debts.some((d) => d.kind === 'student' && Math.abs(d.apr - 0.05) < 1e-9)).toBe(true);
});

test('S5: guess your own month, then see it next to our estimate', async ({ page }) => {
  await page.goto('/me/guess');
  const slider = page.getByRole('slider', { name: ladder.guess.sliderLabel });
  await slider.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: ladder.guess.submit }).click();
  await expect(page.getByRole('region', { name: ladder.guess.compareTitle })).toBeVisible();
  await expect(page.getByTestId('guess-verdict')).not.toBeEmpty();
  await expect(rung(page, 'S5')).toHaveAttribute('data-done', 'true');
});

test('S9: upload the sample statement, review its months, and use them', async ({ page }) => {
  await page.goto('/me/upload');
  const keep = page.getByRole('region', { name: ladder.upload.keep.title });
  await expect(keep).toContainText(ladder.upload.keep.none);
  await expect(keep).toContainText(ladder.upload.keep.neverTitle);
  await expect(keep).toContainText(ladder.upload.keep.sentTitle);

  // Watch what leaves the browser: only masked labels, amounts, months and days.
  const sent = page.waitForRequest((r) => r.url().endsWith('/api/statement/categorize') && r.method() === 'POST');
  await page.getByLabel(ladder.upload.pickerLabel).setInputFiles(SAMPLE_STATEMENT);
  const body = (await sent).postDataJSON() as { items: { label: string; amount: number; month: string; day: number }[] };
  expect(body.items).toHaveLength(170);
  expect(Object.keys(body.items[0]!).sort()).toEqual(['amount', 'day', 'label', 'month']);
  expect(JSON.stringify(body)).not.toMatch(/Tom Becker|Maria Lopez|Daniel Kim|PRIYA SHAH|Jake Morris/i);

  const review = page.getByRole('region', { name: ladder.upload.monthLabel('2026-10') });
  await expect(review).toBeVisible();
  await expect(page.getByTestId('statement-read')).toContainText('Read 170 transactions from Jul 1, 2026 to Nov 12, 2026.');
  await expect(review).toContainText(ladder.upload.detectedPay('$4,800'));
  await expect(keep).toContainText(ladder.upload.keep.payFound);

  await page.getByRole('button', { name: ladder.upload.apply }).click();
  await expect(page.getByText(ladder.upload.applied)).toBeVisible();
  await expect(page.getByText(ladder.upload.history(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']))).toBeVisible();
  await expect(rung(page, 'S9')).toHaveAttribute('data-done', 'true');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? 'null') as {
    state: { statementMonths: { month: string; oneOffs: unknown[] }[]; profile: { takeHomePay: { isEstimate: boolean } } };
  } | null);
  expect(saved?.state.statementMonths.map((m) => m.month)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  expect(saved?.state.statementMonths.every((m) => m.oneOffs.length === 0)).toBe(true); // one-off labels are not kept
  expect(saved?.state.profile.takeHomePay.isEstimate).toBe(false);
});

test('S9: a file without transaction columns gets a clear error', async ({ page }) => {
  await page.goto('/me/upload');
  await page.getByLabel(ladder.upload.pickerLabel).setInputFiles({
    name: 'notes.csv', mimeType: 'text/csv', buffer: Buffer.from('Name,Age\nAnn,30\n'),
  });
  // Next.js has its own (empty) role="alert" route announcer, so pick ours by its text.
  await expect(page.getByRole('alert').filter({ hasText: ladder.upload.errors.unreadable.noColumns })).toBeVisible();
});

for (const route of ['/me/guess', '/me/closest', '/me/sliders', '/me/balance', '/me/upload']) {
  test(`nothing scrolls sideways on ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('navigation', { name: ladder.shell.stepsLabel })).toBeVisible();
    await expect(range(page)).toBeVisible(); // saved state loaded, the screen is fully drawn
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
