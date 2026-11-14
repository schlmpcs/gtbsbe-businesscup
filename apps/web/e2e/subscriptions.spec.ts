// The subscription audit, cold path (issue #81): open /tools/subscriptions with no profile and no upload,
// guess, tick three services, see the gap; then read the sample statement and see the findings, and
// come back to them after a reload (the tool's state is kept in this browser, through the real store).
//
// The services come from the real catalogue (packages/data/subscriptions.json) and the statement is the
// sample one (the `statementPath` fixture of the tools harness), read through the real categorize route
// (keyword rules when the server has no AI key, as on CI). Selectors come from the copy and from roles.
// The golden numbers are M3's: five recurring charges, $69.54 a month, $834.52 a year.
import { subscriptions as t } from '../src/copy/subscriptions';
import { expect, test } from './tools/fixtures';

const TICKED = ['Netflix', 'Spotify', 'Planet Fitness'];

test('guess, tick three, see the gap; read the sample statement and see what was found', async ({ page, statementPath }) => {
  await page.goto('/tools/subscriptions');
  await expect(page.getByRole('heading', { level: 1, name: t.screens.S21 })).toBeVisible();

  await page.getByLabel(t.guess.label).fill('40');
  await page.getByRole('button', { name: t.guess.next }).click();
  for (const name of TICKED) await page.getByRole('checkbox', { name, exact: true }).check();
  await page.getByRole('button', { name: t.ticks.next }).click();
  await expect(page.getByRole('heading', { name: t.reveal.title })).toBeVisible();
  await expect(page.getByText(t.reveal.surveyNote, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: t.reveal.findOnes }).click();
  await page.getByLabel(t.statement.pickerLabel).setInputFiles(statementPath);
  await expect(page.getByRole('heading', { name: t.findings.title })).toBeVisible({ timeout: 15_000 });
  const headline = t.findings.headline(5, TICKED.length);
  const totals = `${t.findings.perMonth('$69.54')} · ${t.findings.perYear('$834.52')}`;
  await expect(page.getByText(headline, { exact: true })).toBeVisible();
  await expect(page.getByText(totals, { exact: true })).toBeVisible();

  // A reload keeps it: the findings are read back from this browser, and the tool opens on them.
  await page.reload();
  await expect(page.getByRole('heading', { name: t.findings.title })).toBeVisible();
  await expect(page.getByText(headline, { exact: true })).toBeVisible();
  await expect(page.getByText(totals, { exact: true })).toBeVisible();
});

test('streamer mode never shows the tool', async ({ page }) => {
  await page.goto('/tools/subscriptions?stream=1');
  await expect(page.getByRole('heading', { level: 1, name: t.streamer.title })).toBeVisible();
  await expect(page.getByLabel(t.guess.label)).toHaveCount(0);
});
