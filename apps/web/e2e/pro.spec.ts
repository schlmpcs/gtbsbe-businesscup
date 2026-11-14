// S15 Pro: the simulated checkout unlocks Pro without Stripe or a card. The e2e server has no
// STRIPE_SECRET_KEY, so /pro offers the simulated checkout (view-model checkoutMode 'demo').
import { expect, test, type Locator } from '@playwright/test';
import { pro as copy } from '../src/copy/pro';

/**
 * WCAG contrast ratio of an element's text over what is painted behind it, as the browser computes
 * it. jsdom has no CSS, so only a real browser can say whether text is readable or white-on-white.
 */
async function textContrast(locator: Locator): Promise<number> {
  return locator.evaluate((el) => {
    // A 1x1 canvas turns any CSS colour (rgb, oklab, with alpha) into plain sRGB bytes.
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!, a! / 255];
    };
    const over = (top: number[], alpha: number, below: number[]) => top.map((v, i) => alpha * v + (1 - alpha) * below[i]!);

    // Backgrounds from the element up to the first opaque one, painted bottom-up over white.
    const layers: [number, number, number, number][] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      const bg = rgba(getComputedStyle(node).backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      if (bg[3] === 1) break;
    }
    let backdrop = [255, 255, 255];
    for (const [r, g, b, a] of layers.reverse()) backdrop = over([r, g, b], a, backdrop);

    const [fr, fg, fb, fa] = rgba(getComputedStyle(el).color);
    const text = over([fr, fg, fb], fa, backdrop);

    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const [hi, lo] = [luminance(text), luminance(backdrop)].sort((a, b) => b - a);
    return (hi! + 0.05) / (lo! + 0.05);
  });
}

const WCAG_AA_TEXT = 4.5;

test('paying in the simulated checkout unlocks Pro and says it is a demo', async ({ page }) => {
  await page.goto('/pro');
  await expect(page.getByText(copy.demoBadge.demo)).toBeVisible();
  await expect(page.getByText(copy.demoCheckout.card)).toBeVisible();
  // The only text field is the promo code: no card number to type.
  await expect(page.getByRole('textbox')).toHaveCount(1);

  await page.getByRole('button', { name: /Pay \$39\.99 \(demo\)/ }).click();

  await expect(page.getByRole('heading', { name: copy.active.successTitle })).toBeVisible();
  await expect(page.getByText(copy.active.sources.demo_checkout)).toBeVisible();

  // The server remembers it: a reload shows Pro, not the offer.
  await page.reload();
  await expect(page.getByRole('heading', { name: copy.active.title })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay \$/ })).toHaveCount(0);
});

// The tests below never pay: they read layout and colours, or answer the request themselves.

test('the Pay button fills a checkout card that fits the screen', async ({ page }) => {
  await page.goto('/pro');
  const pay = page.getByRole('button', { name: /Pay \$39\.99 \(demo\)/ });
  await expect(pay).toBeVisible();
  const box = (await pay.boundingBox())!;
  const viewport = page.viewportSize()!;
  // The button spans its card. A card squeezed by a bad width class (`max-w-md` reads as the 12px
  // spacing token in this theme) made it a ~64px black box with its label spilling out.
  expect(box.width).toBeGreaterThan(240);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);

  // The order note sits inside the card, above the button, not spilled out of it.
  const noteBox = (await page.getByText(copy.demoCheckout.note).boundingBox())!;
  expect(noteBox.x).toBeGreaterThanOrEqual(box.x - 1);
  expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(box.x + box.width + 1);
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(box.y);
});

test('the note under the order is readable on the white card', async ({ page }) => {
  await page.goto('/pro');
  const note = page.getByText(copy.demoCheckout.note);
  await expect(note).toBeVisible();
  // The orange band turns muted text white; on the white order card that is white on white.
  expect(await textContrast(note)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
});

test('a failed payment shows an error that can be read on the card', async ({ page }) => {
  // The browser answers for the server: nothing is sent, so nothing is unlocked.
  await page.route('**/api/pro/demo-checkout', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable' } }) }),
  );
  await page.goto('/pro');
  await page.getByRole('button', { name: /Pay \$39\.99 \(demo\)/ }).click();

  // Not just getByRole('alert'): the Next.js route announcer is an alert too.
  const alert = page.getByRole('alert').filter({ hasText: copy.errors.unavailable });
  await expect(alert).toBeVisible();
  expect(await textContrast(alert)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
});

test('a repeat visit does not flash the Stripe offer while the server is still answering', async ({ page }) => {
  await page.goto('/pro');
  await expect(page.getByText(copy.demoBadge.demo)).toBeVisible(); // the first visit caches the status as a hint

  // Same browser, slow server: the status answer takes 2s (the request itself is passed through).
  await page.route('**/api/pro/status', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.reload();
  await expect(page.getByText(copy.loading)).toBeVisible();
  await page.waitForTimeout(800); // long enough to hydrate and read the cached hint, well inside the 2s wait
  // Still waiting, and nothing from a checkout this server does not run.
  await expect(page.getByText(copy.loading)).toBeVisible();
  await expect(page.getByText(copy.demoBadge.stripe)).toHaveCount(0);
  await expect(page.getByRole('button', { name: copy.checkout.button })).toHaveCount(0);

  await expect(page.getByText(copy.demoBadge.demo)).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay \$39\.99 \(demo\)/ })).toBeEnabled();
});
