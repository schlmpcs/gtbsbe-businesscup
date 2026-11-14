// The subscription audit, cold path (issue #81): open /tools/subscriptions with no profile and no upload,
// guess, tick three services, see the gap; then read the sample statement and see the findings.
//
// WAITS on #78 (M2, the tool's slice of the local store) and on M4 (the catalogue) reaching this branch:
// until `features/subscriptions/model/wiring.ts` is connected the page says the tool is not switched on.
// Flip CONNECTED to true in the same commit that wires it. (M2 adds a Playwright harness with a
// `statementPath` fixture: switch to it then; this spec reads the sample CSV itself.)
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { subscriptions as t } from '../src/copy/subscriptions';

const CONNECTED = false;
const SAMPLE_STATEMENT = fileURLToPath(new URL('../../../packages/data/fixtures/statement.sample.csv', import.meta.url));
const run = CONNECTED ? test : test.skip;

run('guess, tick three, see the gap; read the sample statement and see what was found', async ({ page }) => {
  await page.goto('/tools/subscriptions');
  await expect(page.getByRole('heading', { level: 1, name: t.screens.S21 })).toBeVisible();

  await page.getByLabel(t.guess.label).fill('40');
  await page.getByRole('button', { name: t.guess.next }).click();
  for (const name of ['Netflix', 'Spotify', 'Planet Fitness']) await page.getByRole('checkbox', { name }).check();
  await page.getByRole('button', { name: t.ticks.next }).click();
  await expect(page.getByRole('heading', { name: t.reveal.title })).toBeVisible();
  await expect(page.getByText(t.reveal.surveyNote)).toBeVisible();

  await page.getByRole('button', { name: t.reveal.findOnes }).click();
  await page.getByLabel(t.statement.pickerLabel).setInputFiles(SAMPLE_STATEMENT);
  await expect(page.getByRole('heading', { name: t.findings.title })).toBeVisible();
  await expect(page.getByText(/^Found 5 · you ticked 3$/)).toBeVisible();
});

test('streamer mode never shows the tool', async ({ page }) => {
  await page.goto('/tools/subscriptions?stream=1');
  await expect(page.getByRole('heading', { level: 1, name: t.streamer.title })).toBeVisible();
  await expect(page.getByLabel(t.guess.label)).toHaveCount(0);
});
