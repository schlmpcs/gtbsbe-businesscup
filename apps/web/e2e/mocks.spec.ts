// S13 "Keep your car or switch?" and S14 Monthly check-in on the demo profile and fixtures, phone +
// desktop.
import { expect, test, type Page } from '@playwright/test';
import { mocks } from '../src/copy/mocks';
import { toolPlan } from '../src/copy/toolPlan';

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

const d = mocks.decide;
const c = mocks.checkin;

test.describe('S13 Decision: keep your car or switch', () => {
  test('answers for the person’s own car; switching the alternative and editing a number change it', async ({ page }) => {
    await page.goto('/decide');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(d.title);
    await expect(page.getByText(/Camry|RAV4/)).toHaveCount(0);
    const sentence = page.getByTestId('decide-sentence');
    await expect(sentence).toContainText(/richer by \d{4}\.|about the same by \d{4}\./);
    await expect(page.getByTestId('decide-chart')).toBeVisible();
    await expect(page.getByTestId('decide-costs')).toBeVisible();
    const lease = await sentence.textContent();

    await page.getByText(d.kinds.noCar, { exact: true }).click();
    await expect(page.getByRole('heading', { name: d.altTitle.noCar })).toBeVisible();
    await expect(sentence).not.toHaveText(lease ?? '');
    const noCar = await sentence.textContent();

    await page.getByRole('textbox', { name: new RegExp(`^${d.fields.noCarMonthly}`) }).fill('900');
    await expect(sentence).not.toHaveText(noCar ?? '');
    await expectNoHorizontalScroll(page);
  });

  test('adds a lease to the plan and opens it', async ({ page }) => {
    await page.goto('/decide');
    const plan = page.getByTestId('decide-plan');
    await plan.getByText(d.kindsShort.lease, { exact: true }).click();
    await expect(plan.getByTestId('tool-plan-impact')).toBeVisible();
    await plan.getByTestId('tool-plan-add').click();
    await expect(plan.getByTestId('tool-plan-added')).toBeVisible();
    await plan.getByRole('link', { name: new RegExp(toolPlan.open) }).click();
    await expect(page).toHaveURL(/\/plan/);
    await expect(page.getByText(d.plan.eventName.lease).first()).toBeVisible();
  });
});

test.describe('S14 Monthly check-in', () => {
  test('reviews the sample month (labelled), commits to the top move and marks it done', async ({ page }) => {
    await page.goto('/checkin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(c.eyebrow('October'));
    await expect(page.getByText(c.sampleNote)).toBeVisible();
    await expect(page.getByTestId('checkin-kpis')).toBeVisible();
    await expect(page.getByRole('heading', { name: c.barsTitle })).toBeVisible();
    await expectNoHorizontalScroll(page);

    const move = page.getByTestId('checkin-move');
    await move.getByRole('button', { name: new RegExp(`^${c.move.commit}`) }).click();
    await expect(move.getByText(c.move.question)).toBeVisible();
    await move.getByRole('button', { name: c.move.done }).click();
    await expect(page.getByTestId('checkin-move')).toContainText(c.move.doneTitle);
    await expect(page.getByRole('link', { name: new RegExp(c.addStatement('November')) })).toHaveAttribute('href', '/transactions?import=1');
    await expectNoHorizontalScroll(page);
  });
});
