// Ladder S5–S9 (Y9, T6/T7): build a profile end to end in a real browser, on phone and desktop.
// closest life → your spending (a statement first; by hand as the fallback) → balance sheet → /future,
// through each step's CTA.
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
/** Saved state read: neither the steps nor the screen says "Loading your numbers…" any more. */
const loaded = (page: Page) => expect(page.getByText(ladder.shell.loading)).toHaveCount(0);

/** The saved app state (Zustand persist in localStorage). */
async function savedProfile(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('lifeguessr.app');
    return raw ? (JSON.parse(raw) as { state: { profile: { debts: { kind: string; apr: number; minPayment: { isEstimate: boolean } }[] }; profileOrigin: string; closestCardId: string | null } }).state : null;
  });
}

test('closest life → your spending (by hand) → balance sheet with a new debt → /future', async ({ page }) => {
  // Against a deployment with a model key the last step may wait up to 25 s for the forecast on top of the
  // steps before it: three times the default timeout.
  test.slow();
  // S6: About you, then start from the month built for that household and ZIP.
  await page.goto('/me/closest');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(ladder.screens.S6);
  // One task per step: no 10-year strip, and the CTA waits for a ZIP we have data for.
  await loaded(page);
  await expect(page.getByTestId('ladder-in10y')).toHaveCount(0);
  await expect(page.getByRole('button', { name: ladder.shell.cta.S6 })).toBeDisabled();
  await page.getByLabel(ladder.closest.about.zip).fill('75205');
  // The life built from the answers is preselected: the CTA is live before any tap (JF13).
  const choose = page.getByRole('button', { name: new RegExp(`^${ladder.closest.choose}`) });
  await expect(choose).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: ladder.shell.cta.S6 })).toBeEnabled();
  await expect(page.getByText(ladder.closest.preselectedNote)).toBeVisible();
  await choose.click();
  await expect(choose).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(ladder.closest.chosenNote)).toBeVisible();
  await expect(rung(page, 'S6')).toHaveAttribute('data-done', 'true');
  expect((await savedProfile(page))?.profileOrigin).toBe('closestLife');

  // Your spending: the CTA leads to the statement import (S9); without one, set it by hand (S7).
  await page.getByRole('link', { name: ladder.shell.cta.S6 }).click();
  await expect(page).toHaveURL(/\/me\/upload$/);
  await expect(rung(page, 'S9')).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('ladder-in10y')).toHaveCount(0);
  await page.getByRole('link', { name: ladder.upload.fork.byHandLink }).click();
  await expect(page).toHaveURL(/\/me\/sliders$/);
  await expect(rung(page, 'S9')).toHaveAttribute('aria-current', 'step');
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  const monthCost = page.getByTestId('month-cost');
  const costBefore = await monthCost.textContent();
  const valueBefore = await eatingOut.getAttribute('aria-valuetext');
  await eatingOut.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(eatingOut).not.toHaveAttribute('aria-valuetext', valueBefore ?? '');
  await expect(monthCost).not.toHaveText(costBefore ?? '');
  await expect(rung(page, 'S9')).toHaveAttribute('data-done', 'true');
  // The free-text box duplicates the sliders: one text link until opened.
  const describe = page.getByRole('button', { name: ladder.sliders.describe.open });
  await expect(describe).toHaveAttribute('aria-expanded', 'false');
  await describe.click();
  await expect(page.getByRole('textbox', { name: ladder.sliders.describe.label })).toBeVisible();

  // S8: add a student loan; APR typed as a percent, saved as a decimal; minimum left empty.
  await page.getByRole('link', { name: ladder.shell.cta.S7 }).click();
  await expect(page).toHaveURL(/\/me\/balance$/);
  const debtLoad = page.getByRole('meter', { name: ladder.balance.debtLoadLabel });
  const loadBefore = await debtLoad.getAttribute('aria-valuenow');
  // Confirm, not type (JF17): tap the kind, type the balance; the APR comes prefilled (then edited here).
  await page.getByRole('button', { name: ladder.balance.addKindLabel(ladder.balance.debtKinds.student) }).click();
  const form = page.getByRole('form', { name: ladder.balance.formTitleAdd });
  await expect(form.getByRole('radio', { name: ladder.balance.debtKinds.student })).toBeChecked();
  await form.getByLabel(ladder.balance.balanceLabel).fill('20000');
  await expect(form.getByLabel(ladder.balance.aprLabel)).not.toHaveValue('');
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

  // S8 is the last step: its one 10-year line is the engine's number, tagged as an estimate.
  const line = page.getByTestId('ladder-in10y');
  await expect(line).toContainText(ladder.shell.in10yLabel);
  await expect(line.getByText(common.estimateTag)).toBeVisible();
  await expect(page.getByText(forecast.source.rulesPreview)).toHaveCount(0);
  const in10y = (await line.getByText(/^−?\$[\d,]+$/).textContent()) ?? '';
  expect(in10y).toMatch(/\$/);

  // S10: the CTA leads to the forecast of the profile built above. S10 shows the same number only while its
  // own answer is the rules forecast (always so in CI, where there is no model key); with the model's answer
  // it shows another number, labeled as the AI's.
  await page.getByRole('link', { name: ladder.shell.cta.last }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(forecast.future.title(10));
  const headlineSource = page.getByTestId('at-horizon').getByTestId('forecast-source');
  await expect(headlineSource).toBeVisible({ timeout: 30_000 }); // the model has up to 25 s before the rules answer
  if ((await headlineSource.getAttribute('data-source')) === 'rules') {
    await expect(headlineSource).toHaveText(forecast.source.rules);
    await expect(page.getByTestId('at-horizon')).toContainText(in10y);
  } else {
    await expect(headlineSource).toHaveText(forecast.source.ai);
  }
  await page.getByTestId('chart-disclosure-summary').click(); // JF16: behind a disclosure
  await expect(page.getByRole('figure', { name: forecast.future.chartTitle(10) }).locator('.recharts-line-curve').first()).toBeVisible();
  const after = await savedProfile(page);
  expect(after?.profile.debts.some((d) => d.kind === 'student' && Math.abs(d.apr - 0.05) < 1e-9)).toBe(true);
});

test('statement first: import the sample, answer one follow-up, skip one, and reach /future without a slider', async ({ page }) => {
  test.slow(); // the last step may wait for the model's forecast on a deployment with a key
  await page.goto('/me/closest');
  await loaded(page);
  // About you: a ZIP preselects the month built for that household (S6).
  await page.getByLabel(ladder.closest.about.zip).fill('75205');
  await expect(page.getByRole('link', { name: ladder.shell.cta.S6 })).toBeEnabled();
  await page.getByRole('link', { name: ladder.shell.cta.S6 }).click();
  await expect(page).toHaveURL(/\/me\/upload$/);

  // The step opens with the fork: a bank CSV (most accurate), or no statement → by hand.
  const csv = page.getByRole('region', { name: ladder.upload.fork.statementTitle });
  await expect(csv).toContainText(ladder.upload.fork.statementBadge);
  await expect(page.getByRole('region', { name: ladder.upload.fork.byHandTitle }).getByRole('link', { name: ladder.upload.fork.byHandLink }))
    .toHaveAttribute('href', '/me/sliders');

  const sent = page.waitForRequest((r) => r.url().endsWith('/api/statement/categorize') && r.method() === 'POST');
  await csv.getByRole('button', { name: ladder.upload.trySample }).click();
  await sent;

  // A few follow-ups for what the statement can't settle (with the keyword rules, as in CI: the
  // cash withdrawal, CVS and Target); the amounts are the engine's.
  const questions = page.getByRole('region', { name: ladder.upload.questions.title });
  await expect(questions).toBeVisible();
  const groups = questions.getByRole('listitem'); // one per question (its answer choices are a group inside it)
  const count = await groups.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(3);
  // Skip them all, then change your mind about the first store (each sample store has October charges).
  for (let i = 0; i < count; i++) await groups.nth(i).getByRole('button', { name: ladder.upload.questions.skip }).click();
  await expect(groups.filter({ hasText: ladder.upload.questions.skipped })).toHaveCount(count);
  const store = groups.filter({ hasNotText: /cash/i }).first();
  await expect(store).toContainText(/About \$[\d,]+ a month/);
  // November stops on the 12th: shown, but not averaged in.
  await expect(page.getByRole('region', { name: ladder.upload.monthLabel('2026-11') })).toContainText(ladder.upload.partialMonth);
  const october = page.getByRole('region', { name: ladder.upload.monthLabel('2026-10') });
  await expect(october).not.toContainText(ladder.upload.partialMonth);
  const groceries = october.getByRole('listitem').filter({ hasText: common.categories.groceries });
  const groceriesBefore = await groceries.textContent();
  await store.getByText(common.categories.groceries, { exact: true }).click();
  await expect(store).toContainText(ladder.upload.questions.answeredCategory(common.categories.groceries));
  // The months follow the answer: the store's October charges now count as groceries.
  await expect(groceries).not.toHaveText(groceriesBefore ?? '');
  await expect(groups.filter({ hasText: ladder.upload.questions.skipped })).toHaveCount(count - 1);

  await page.getByRole('button', { name: ladder.upload.apply }).click();
  await expect(page.getByText(ladder.upload.applied)).toBeVisible();
  await expect(rung(page, 'S9')).toHaveAttribute('data-done', 'true');

  // Spending is measured from the statement: no slider was touched to get here.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? 'null') as {
    state: { profile: { spending: Record<string, { value: number; isEstimate: boolean }> }; statementMonths: unknown[] };
  } | null);
  for (const c of ['rentUtilities', 'car', 'groceries', 'eatingOut', 'subscriptions', 'other']) {
    expect(saved?.state.profile.spending[c]?.isEstimate, c).toBe(false);
  }
  expect(JSON.stringify(saved?.state)).not.toMatch(/TARGET|ATM WITHDRAWAL|Zelle/i); // only totals are kept

  await page.getByRole('link', { name: ladder.shell.cta.S9 }).click();
  await expect(page).toHaveURL(/\/me\/balance$/);
  await page.getByRole('link', { name: ladder.shell.cta.last }).click();
  await expect(page).toHaveURL(/\/future$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(forecast.future.title(10));
  await expect(page.getByTestId('at-horizon').getByTestId('forecast-source')).toBeVisible({ timeout: 30_000 });

  // The sliders, if opened, show the imported numbers for confirmation, not entry.
  await page.goto('/me/sliders');
  await expect(page.getByTestId('sliders-from-statement')).toContainText('Jul 2026 to Oct 2026');
});

test('S5: only the gut guess, with no estimate to compare it with yet', async ({ page }) => {
  await page.goto('/me/guess');
  const slider = page.getByRole('slider', { name: ladder.guess.sliderLabel });
  await slider.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
  await page.getByRole('button', { name: ladder.guess.submit }).click();
  await expect(page.getByRole('link', { name: ladder.shell.cta.S5 })).toBeVisible();
  await expect(page.getByTestId('guess-reveal')).toHaveCount(0);
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

test('S9: "Try with sample statement" reads the sample through the same path as an upload', async ({ page }) => {
  await page.goto('/me/upload');
  await expect(page.getByText(/connect your bank/i)).toHaveCount(0); // not built: hidden
  const sent = page.waitForRequest((r) => r.url().endsWith('/api/statement/categorize') && r.method() === 'POST');
  await page.getByRole('button', { name: ladder.upload.trySample }).click();
  const body = (await sent).postDataJSON() as { items: { label: string }[] };
  expect(body.items).toHaveLength(170);
  expect(JSON.stringify(body)).not.toMatch(/Tom Becker|Maria Lopez|Daniel Kim|PRIYA SHAH|Jake Morris/i);
  await expect(page.getByTestId('statement-read')).toContainText('Read 170 transactions from Jul 1, 2026 to Nov 12, 2026.');
  await expect(page.getByRole('region', { name: ladder.upload.monthLabel('2026-10') })).toContainText(ladder.upload.detectedPay('$4,800'));
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
    await loaded(page); // saved state loaded, the screen is fully drawn
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}
