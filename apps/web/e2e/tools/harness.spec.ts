import { test, expect } from './fixtures';
test('tool harness starts cold with a sample statement and local defaults', async ({
  page,
  statementPath,
}) => {
  expect(statementPath).toMatch(/statement\.sample\.csv$/);
  await page.goto('/me/upload');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('lifeguessr.app')!),
  );
  expect(saved.state.tools).toEqual({});
});
