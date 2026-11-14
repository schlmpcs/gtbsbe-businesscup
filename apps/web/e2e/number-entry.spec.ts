// The judges' path: a fresh browser lands on "Know your number." with an engine-computed sample life,
// opens the sample life (S10 leads with the big number), and takes the 2-minute tour.
import { expect, test } from '@playwright/test';
import { common } from '../src/copy/common';
import { forecast as t } from '../src/copy/forecast';
import { tour } from '../src/copy/tour';

const year = new Date().getFullYear() + 10;

test('fresh browser: Know your number → See a sample life → the big number with the sample goal', async ({ page }) => {
  const f = t.today.firstVisit;
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: f.title })).toBeVisible();
  const card = page.getByTestId('sample-life');
  await expect(card).toContainText(f.card.computed);
  await expect(card.getByTestId('sample-number')).toHaveText(/^\$[\d,]+$/);
  await expect(card.getByTestId('sample-moves').getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText(`${common.sourcesNote} ${common.disclaimer}`)).toBeVisible();

  await page.getByTestId('today-first-visit').getByRole('link', { name: f.sample, exact: true }).click();
  await expect(page).toHaveURL(/\/future$/);
  const hero = page.getByTestId('your-number');
  await expect(hero.getByText(t.future.hero.number(year))).toBeVisible();
  await expect(hero.getByText(/^\$[\d,]+$/)).toBeVisible();
  await expect(hero.getByTestId('number-source')).toHaveText(t.future.hero.source);
  await expect(hero.getByTestId('number-goal')).toContainText(t.future.hero.sampleGoal('$200,000', year));
  // The moves read as gains to the number.
  await expect(page.getByTestId('moves').getByRole('article').first().getByText(t.moves.effectLabel)).toBeVisible();
});

test('the 2-minute tour opens from the header, shows the promo code, and its links go to real screens', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tour-open').click();
  const dialog = page.getByRole('dialog', { name: tour.title });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('list', { name: tour.stepsLabel }).getByRole('listitem')).toHaveCount(6);
  await expect(dialog.getByTestId('tour-promo')).toContainText('Judges: promo code ');
  await expect(dialog.getByText(tour.preview)).toBeVisible();
  await expect(dialog.locator('a[href*="preview"]')).toHaveCount(0);

  await dialog.getByRole('link', { name: tour.steps.loan.title }).click();
  await expect(page).toHaveURL(/\/loan$/);
  await expect(page.getByRole('dialog', { name: tour.title })).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the tour also opens from the first-visit screen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('first-visit-tour').click();
  const dialog = page.getByRole('dialog', { name: tour.title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: tour.steps.sample.title }).click();
  await expect(page).toHaveURL(/\/future/);
  await expect(page.getByTestId('your-number')).toBeVisible();
});
