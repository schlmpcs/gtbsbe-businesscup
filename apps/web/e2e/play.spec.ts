// /play (S2–S4) as the slider game in a real browser on the fixture game: explore the house + clues
// + guess → reveal → summary, and streamer mode's countdown. Runs on the phone and desktop projects.
// The slider is the rollback (NEXT_PUBLIC_GAME_MODE=slider, read at build time): by default /play is
// the duel (duel.spec.ts, demo-path.spec.ts), so these run only on a slider build:
//   NEXT_PUBLIC_GAME_MODE=slider pnpm e2e
import { expect, test, type Page } from '@playwright/test';
import { common } from '../src/copy/common';
import { game as t } from '../src/copy/game';

const scene = common.kit.houseScene;

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

test.skip(process.env.NEXT_PUBLIC_GAME_MODE !== 'slider', '/play is the duel in this build (NEXT_PUBLIC_GAME_MODE=slider plays the slider)');
const lockIn = (page: Page) => page.getByRole('button', { name: /^Lock in/ });

test('play 3 homes with clues, see each reveal, finish the day and share', async ({ page, isMobile }) => {
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
  await expect(h1(page)).toHaveText(t.screens.S2);

  const rooms = [t.clues.rooms.kitchen, t.clues.rooms.garage, t.clues.rooms.mailbox] as const;
  for (let i = 0; i < 3; i++) {
    await expect(page.getByText(t.progress(i + 1, 5))).toBeVisible();
    await expect(page.getByText(t.multiplier.cost('10%'))).toBeVisible();

    // Open one room in the house: it zooms in, the close-up shows its props and facts, and the
    // multiplier drops. The sprites are real files served from public/scene.
    await page.getByRole('button', { name: rooms[i], exact: true }).click();
    const closeUp = page.getByRole('region', { name: scene.closeUp(rooms[i]) });
    await expect(closeUp).toBeVisible();
    await expect(closeUp.getByText(t.clues.opened)).toBeVisible();
    await expect(page.getByText('90%', { exact: true })).toBeVisible();
    const sprite = closeUp.locator('img').first();
    await expect(sprite).toBeVisible();
    await expect.poll(() => sprite.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expectNoSideScroll(page);
    await closeUp.getByRole('button', { name: scene.back }).click();
    await expect(closeUp).toHaveCount(0);
    await expect(page.getByRole('button', { name: rooms[i], exact: true })).toBeFocused();

    // Type an exact guess, then lock it in. Focusing the box swaps "1,200" for "1200" and selects it,
    // so keys typed straight after the tap replace the old guess instead of appending to it.
    const input = page.getByRole('textbox', { name: t.guess.input });
    if (isMobile) await input.tap();
    else await input.click();
    await expect(input).toHaveValue(/^\d+$/);
    await page.keyboard.type(String(3000 + i * 1500));
    await expect(input).toHaveValue(String(3000 + i * 1500));
    await input.blur();
    await expect(lockIn(page)).toHaveText(t.guess.lockIn(`$${(3000 + i * 1500).toLocaleString('en-US')}`));
    await expectNoSideScroll(page);
    await lockIn(page).click();

    // S3: the answer, the guess on the range, points, bars with sources.
    await expect(h1(page)).toHaveText(t.screens.S3);
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
    await expect(h1(page)).toHaveText(t.screens.S2);
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
  await expect(h1(page)).toHaveText(t.screens.S4);
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
  await expect(h1(page)).toHaveText(t.screens.S4);
});
