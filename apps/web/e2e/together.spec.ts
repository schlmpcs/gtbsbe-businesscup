// "Together" (/together): a couple's shared plan via a link, no login. Two browsers: partner 1
// creates the plan and gets the link; partner 2 opens it in their own browser, adds their numbers
// and sees the household split; partner 1 then sees it too. Runs in either storage mode: on the
// server (/api/together, CI's Postgres build) or, without a store, carried in the link itself.
import { expect, test, type Page } from '@playwright/test';
import { together as t } from '../src/copy/together';
import { tools } from '../src/copy/tools';

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

const box = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

async function fillPartner(page: Page, numbers: { nickname: string; pay: string; rent: string; groceries?: string }) {
  await box(page, t.form.nickname).fill(numbers.nickname);
  await box(page, t.form.takeHomePay).fill(numbers.pay);
  await box(page, t.form.rentUtilities).fill(numbers.rent);
  if (numbers.groceries) await box(page, t.form.groceries).fill(numbers.groceries);
}

test('the What if? hub lists Together', async ({ page }) => {
  await page.goto('/tools');
  await page.getByRole('link', { name: new RegExp(tools.hub.items.together.question.replace('?', '\\?')) }).click();
  await expect(page).toHaveURL(/\/together$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t.title);
});

test('two partners plan together through a link, without signing up', async ({ page, browser }, testInfo) => {
  const errors1 = watchErrors(page);

  // Partner 1: their numbers, then "Plan together".
  await page.goto('/together');
  await expect(page.getByTestId('together-create')).toBeDisabled(); // no take-home pay yet
  await expect(page.getByTestId('together-steps').locator('[aria-current="step"]')).toContainText(t.steps.items[0]!.title);
  await expect(page.getByText(t.form.problems.takeHomePay)).toHaveCount(0); // no red before typing
  await fillPartner(page, { nickname: 'Jo', pay: '6000', rent: '1200', groceries: '300' });
  await page.getByTestId('together-create').click();
  await expect(page).toHaveURL(/\/together\/[A-Za-z0-9_-]{22}(#plan=.+)?$/);
  const link = await page.getByTestId('together-link').inputValue();
  expect(link).toMatch(/^https?:\/\/[^/]+\/together\/[A-Za-z0-9_-]{22}/);
  await expect(page.getByTestId('together-waiting')).toContainText(t.plan.waiting(t.partner2));
  await expect(page.getByTestId('together-steps').locator('[aria-current="step"]')).toContainText(t.steps.items[1]!.title);
  // Copy gives feedback either way: copied, or how to copy by hand where the clipboard is blocked.
  await page.getByTestId('together-copy').click();
  await expect(page.getByTestId('together-copy-status')).toHaveText(new RegExp(`${t.plan.copiedLive}|${t.plan.copyFailed}`));

  // Partner 2: a different browser (no shared storage) opens the link.
  const other = await browser.newContext({ ...testInfo.project.use });
  try {
    const page2 = await other.newPage();
    const errors2 = watchErrors(page2);
    await page2.goto(link);
    await expect(page2.getByRole('heading', { level: 1 })).toHaveText(t.plan.joinTitle('Jo'));
    await fillPartner(page2, { nickname: 'Alex', pay: '4000', rent: '1000' });
    await page2.getByTestId('together-submit').click();

    // Shared bills 1,200 + 300 + 1,000 = 2,500, split 60/40 by take-home pay.
    await expect(page2.getByTestId('together-split-line')).toHaveText(t.result.splitLine('Jo', '$1,500', 'Alex', '$1,000'));
    await expect(page2.getByTestId('together-split')).toContainText(t.result.evenLine('$1,250'));
    await expect(page2.getByTestId('together-month')).toContainText('$10,000');
    await expect(page2.getByTestId('together-future')).toContainText(t.result.rulesTag);
    await expect(page2.getByTestId('together-goal')).toContainText(t.result.goalNone);

    // The split bar flips to 50/50 and back.
    await page2.getByText(t.result.splitModes.even, { exact: true }).click();
    await expect(page2.getByTestId('together-split-line')).toHaveText(t.result.splitLine('Jo', '$1,250', 'Alex', '$1,250'));
    await page2.getByText(t.result.splitModes.income, { exact: true }).click();
    await expect(page2.getByTestId('together-split-line')).toHaveText(t.result.splitLine('Jo', '$1,500', 'Alex', '$1,000'));

    // Partner 1 sees the same plan from partner 2's link (on the server it is the same link).
    await page.goto('about:blank'); // a full load, not a same-page #fragment change
    await page.goto(page2.url());
    await expect(page.getByTestId('together-split-line')).toHaveText(t.result.splitLine('Jo', '$1,500', 'Alex', '$1,000'));

    // Phones: nothing scrolls sideways.
    const { scrollWidth, clientWidth } = await page2.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    expect(errors2, errors2.join('\n')).toEqual([]);
  } finally {
    await other.close();
  }
  expect(errors1, errors1.join('\n')).toEqual([]);
});

test('an unknown plan link says so', async ({ page }) => {
  await page.goto('/together/AAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.getByTestId('together-not-found')).toHaveText(t.plan.notFound);
});
