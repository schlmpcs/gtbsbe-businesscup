import { expect, test } from '@playwright/test';
test.skip(
  process.env.NEXT_PUBLIC_AVATARS_ENABLED !== 'true',
  'Avatar publishing is off by default.',
);
test('forecast → exact preview → consent → publish → privacy disclosure → unpublish', async ({
  page,
}) => {
  await page.goto('/future?sample=1');
  await page.getByTestId('goal-disclosure-summary').click(); // JF16: behind a disclosure
  const optIn = page.getByText(
    'Let strangers meet a rounded version of you in the daily duel?',
    { exact: true },
  );
  await expect(optIn).toBeVisible();
  await optIn.click();
  await page
    .getByRole('button', { name: 'Preview my avatar', exact: true })
    .click();
  const draft = page.getByTestId('avatar-payload');
  await expect(draft).toBeVisible();
  const previewResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/avatar/preview') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Refresh preview', exact: true })
    .click();
  const preview = (await (await previewResponse).json()).preview.payload;
  await page.getByRole('checkbox', { name: /I choose to publish/ }).check();
  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/avatar') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Publish avatar', exact: true })
    .click();
  const published = (await (await publishResponse).json()).published;
  const { avatarId, ...payload } = published;
  expect(avatarId).toHaveLength(22);
  expect(payload).toEqual(preview);
  await expect(page.getByRole('button', {name:'Unpublish',exact:true})).toBeVisible();
  await page.goto('/me/upload');
  // "Exactly what we keep" sits inside the collapsed "What we keep" disclosure: open that first.
  await page.getByTestId('what-we-keep-details').locator('summary').first().click();
  await page.getByText('Exactly what we keep', { exact: true }).click();
  await expect(page.getByText(/Published avatar: age band/)).toBeVisible();
  await page.goto('/future');
  await page.getByTestId('goal-disclosure-summary').click(); // JF16: behind a disclosure
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Published avatar', exact: true }),
  ).toHaveCount(0);
});
