// The subscription audit (issue #81; JF8 #140: detection first). Open /tools/subscriptions with no profile:
// it opens on the statement upload; read the sample statement and see what was found, and come back to it
// after a reload (the tool's state is kept in this browser, through the real store). With no statement,
// the by-hand fallback: guess, tick three services, see the gap.
//
// The services come from the real catalogue (packages/data/subscriptions.json) and the statement is the
// sample one (the `statementPath` fixture of the tools harness), read through the real categorize route
// (keyword rules when the server has no AI key, as on CI). Selectors come from the copy and from roles.
// The golden numbers are M3's: five recurring charges, $69.54 a month, $834.52 a year.
import { planImpact as pi } from '../src/copy/planImpact';
import { subscriptions as t } from '../src/copy/subscriptions';
import { expect, test } from './tools/fixtures';

const TICKED = ['Netflix', 'Spotify', 'Planet Fitness'];

test('opens on the statement; read the sample statement and see what was found, also after a reload', async ({ page, statementPath }) => {
  await page.goto('/tools/subscriptions');
  await expect(page.getByRole('heading', { level: 1, name: t.screens.S21 })).toBeVisible();

  await page.getByLabel(t.statement.pickerLabel).setInputFiles(statementPath);
  await expect(page.getByRole('heading', { name: t.findings.title })).toBeVisible({ timeout: 15_000 });
  const headline = t.findings.headline(5, 0);
  // Whole dollars: $69.54 a month, $834.52 a year.
  const kpis = page.getByTestId('subs-kpis');
  await expect(page.getByText(headline, { exact: true })).toBeVisible();
  await expect(kpis).toContainText('$70');
  await expect(kpis).toContainText('$835');
  await expect(page.getByTestId('subs-chart')).toBeVisible();

  // A reload keeps it: the findings are read back from this browser, and the tool opens on them.
  await page.reload();
  await expect(page.getByRole('heading', { name: t.findings.title })).toBeVisible();
  await expect(page.getByText(headline, { exact: true })).toBeVisible();
  await expect(page.getByTestId('subs-kpis')).toContainText('$835');

  // Tick one to stop, see what it does to the plan, add it.
  await page.getByRole('checkbox', { name: t.plan.mark('Netflix') }).check();
  const impact = page.getByTestId('cancel-impact');
  await expect(impact).toBeVisible();
  await expect(impact.getByTestId('impact-10y')).toContainText('+$');
  await impact.getByRole('button', { name: pi.add }).click();
  await expect(impact.getByText(pi.added)).toBeVisible();
});

test('no statement: by hand, guess, tick three, see the gap', async ({ page }) => {
  await page.goto('/tools/subscriptions');
  await page.getByRole('button', { name: t.statement.byHand }).click();
  await page.getByLabel(t.guess.label).fill('40');
  await page.getByRole('button', { name: t.guess.next }).click();
  for (const name of TICKED) await page.getByRole('checkbox', { name, exact: true }).check();
  await page.getByRole('button', { name: t.ticks.next }).click();
  await expect(page.getByRole('heading', { name: t.reveal.title })).toBeVisible();
  await expect(page.getByText(t.reveal.surveyNote, { exact: true })).toBeVisible();
});

test('streamer mode never shows the tool', async ({ page }) => {
  await page.goto('/tools/subscriptions?stream=1');
  await expect(page.getByRole('heading', { level: 1, name: t.streamer.title })).toBeVisible();
  await expect(page.getByLabel(t.statement.pickerLabel)).toHaveCount(0);
});
