// T4: "reload keeps the profile without sign-up", through the server session. Runs when the build
// saves sessions to the API (NEXT_PUBLIC_SESSION_SOURCE=api, as CI's e2e job sets it with a real
// Postgres store); a local-only build keeps everything in localStorage and skips it.
import { expect, test, type Page } from '@playwright/test';
import { common } from '../src/copy/common';

test.skip(process.env.NEXT_PUBLIC_SESSION_SOURCE !== 'api', 'the build does not save sessions to the API');

type Saved = { state: { profile: { spending: { eatingOut: { value: number } } }; profileOrigin: string } };
const savedApp = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('lifeguessr.app') ?? 'null') as Saved | null);

let pageErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
  });
});
test.afterEach(() => {
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});

test('a profile edit is saved to the server and restored after the browser loses its app state', async ({ page, browser }) => {
  await page.goto('/me/sliders');
  const eatingOut = page.getByRole('slider', { name: common.categories.eatingOut });
  await expect(eatingOut).toBeVisible();

  // Edit the profile, then wait for the debounced save to reach the server.
  const saved = page.waitForResponse(
    (r) => r.url().endsWith('/api/session') && r.request().method() === 'POST' && (r.request().postData() ?? '').includes('"profile"'),
  );
  await eatingOut.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  const response = await saved;
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok: boolean; revision: number };
  expect(body.ok).toBe(true);
  expect(body.revision).toBeGreaterThan(0);

  // Wait until the server holds exactly what this browser holds (a later save may still follow).
  const anonId = await page.evaluate(() => localStorage.getItem('lifeguessr.anonId'));
  expect(anonId).toMatch(/^[0-9a-f-]{36}$/);
  expect(response.url()).not.toContain(anonId!); // the anonymous id never goes in a URL
  const edited = (await savedApp(page))!.state.profile.spending.eatingOut.value;
  await expect
    .poll(async () => {
      const res = await page.request.get('/api/session', { headers: { 'x-anon-id': anonId! } });
      return ((await res.json()) as { profile?: { spending: { eatingOut: { value: number } } } }).profile?.spending.eatingOut.value;
    })
    .toBe(edited);

  // Lose the app state but keep the anonymous id, then reload: the server copy comes back.
  await page.evaluate(() => localStorage.removeItem('lifeguessr.app'));
  await page.reload();
  await expect.poll(async () => (await savedApp(page))?.state.profile.spending.eatingOut.value).toBe(edited);
  expect((await savedApp(page))?.state.profileOrigin).toBe('user');

  // A different browser (a new anonymous id) does not see it.
  const other = await browser.newContext();
  try {
    const otherPage = await other.newPage();
    const loaded = otherPage.waitForResponse((r) => r.url().endsWith('/api/session') && r.request().method() === 'POST');
    await otherPage.goto('/me/sliders');
    const otherBody = (await (await loaded).json()) as { revision: number; profile?: unknown };
    expect(otherBody.revision).toBe(0);
    expect(otherBody.profile).toBeUndefined();
  } finally {
    await other.close();
  }
});
