// /play (S2–S4) in a real browser on the fixture game: explore + clues + guess → reveal → summary,
// and streamer mode's countdown. Runs on the phone and desktop projects.
import { expect, test, type Page } from '@playwright/test';
import { game as t } from '../src/copy/game';

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

async function expectNoSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const lockIn = (page: Page) => page.getByRole('button', { name: /^Lock in/ });

test('play 3 homes with clues, see each reveal, finish the day and share', async ({ page }) => {
  // Stand-in share sheet so the Share button's Web Share path is exercised on every browser.
  await page.addInitScript(() => {
    const shared: string[] = [];
    Object.assign(window, { __shared: shared });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        shared.push(data.text ?? '');
      },
    });
  });

  await page.goto('/play');
  await expect(h1(page)).toContainText('S2');

  const rooms = [t.clues.rooms.kitchen, t.clues.rooms.garage, t.clues.rooms.mailbox] as const;
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(t.progress(i + 1, 5))).toBeVisible();
    await expect(page.getByText(t.multiplier.cost('10%'))).toBeVisible();

    // Open one room: the button turns into the room's facts and the multiplier drops.
    await page.getByRole('button', { name: new RegExp(`^${rooms[i]}`) }).click();
    await expect(page.getByRole('button', { name: new RegExp(`^${rooms[i]}`) })).toHaveCount(0);
    await expect(page.getByText(t.clues.opened)).toBeVisible();
    await expect(page.getByText('90%', { exact: true })).toBeVisible();

    // Type an exact guess, then lock it in.
    // Focus first: the box swaps its formatted text for the plain number on focus, then fill replaces it.
    const input = page.getByRole('textbox', { name: t.guess.input });
    await input.click();
    await expect(input).toHaveValue(/^\d+$/);
    await input.fill(String(3000 + i * 1500));
    await input.blur();
    await expect(lockIn(page)).toHaveText(t.guess.lockIn(`$${(3000 + i * 1500).toLocaleString('en-US')}`));
    await expectNoSideScroll(page);
    await lockIn(page).click();

    // S3: the answer, the guess on the range, points, bars with sources.
    await expect(h1(page)).toContainText('S3');
    await expect(page.getByRole('figure', { name: /Your guess/ })).toBeVisible();
    await expect(page.getByText(/base points × 90% for 1 room opened/)).toBeVisible();
    await expect(page.getByRole('list', { name: t.reveal.breakdownLabel })).toBeVisible();
    await page.getByText(t.reveal.sourcesHeading).click();
    await expect(page.getByText(/^Source:/).first()).toBeVisible();
    await expectNoSideScroll(page);
    await page.getByRole('button', { name: t.reveal.next }).click();
  }

  // Homes 4 and 5: guess blind with the slider (keyboard), no clues.
  for (let i = 3; i < 5; i++) {
    await expect(page.getByText(t.progress(i + 1, 5))).toBeVisible();
    await expect(h1(page)).toContainText('S2');
    const slider = page.getByRole('slider', { name: t.guess.slider });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await lockIn(page).click();
    await expect(page.getByText(/base points × 100% for 0 rooms opened/)).toBeVisible();
    await page.getByRole('button', { name: i === 4 ? t.reveal.finish : t.reveal.next }).click();
  }

  // Summary: emoji grid, total, share, and the bridge to S5.
  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
  await expect(page.getByRole('list', { name: t.summary.gridLabel }).getByRole('listitem')).toHaveCount(5);
  await expect(page.getByRole('link', { name: t.summary.cta })).toHaveAttribute('href', '/me/guess');
  await page.getByRole('button', { name: t.summary.share }).click();
  await expect(page.getByRole('status')).toHaveText(t.summary.shareStatus.shared);
  const shared = await page.evaluate(() => (window as unknown as { __shared: string[] }).__shared);
  expect(shared).toHaveLength(1);
  expect(shared[0]).toMatch(/^LifeGuessr \d{4}-\d{2}-\d{2}\n[🟩🟨🟥]{5}\n[\d,]+ \/ 5,000$/u);
  await expectNoSideScroll(page);

  // Progress survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { name: t.summary.heading })).toBeVisible();
});

test('S4 streamer mode loads big and counts down; lock in reveals', async ({ page }) => {
  await page.goto('/play?stream=1');
  await expect(h1(page)).toContainText('S4');
  const timer = page.getByRole('timer');
  await expect(timer).toHaveText(t.streamer.seconds(30));
  await page.getByRole('button', { name: t.streamer.start }).click();
  await expect(timer).not.toHaveText(t.streamer.seconds(30), { timeout: 5_000 });
  await expect(timer).toHaveText(/^(2\d|1\d)s$/);
  await page.getByRole('button', { name: t.streamer.pause }).click();
  await expect(page.getByRole('button', { name: t.streamer.start })).toBeVisible();
  await expectNoSideScroll(page);

  await lockIn(page).click();
  await expect(page.getByRole('button', { name: t.reveal.next })).toBeVisible();
  await expect(page.getByRole('figure', { name: /Your guess/ })).toBeVisible();
  await expect(h1(page)).toContainText('S4');
});
