import { test, expect } from "@playwright/test";
import path from "node:path";
test("three homes to personal forecast, private CSV and Loan Lab", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/play");
  for (let home = 0; home < 3; home++) {
    await expect(
      page.getByRole("heading", { name: new RegExp(`Home ${home + 1} of 5`) }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Garage/ }).click();
    await expect(page.getByText("garage", { exact: true })).toBeVisible();
    await page
      .getByLabel("Your guess · dollars per month")
      .fill(String(3000 + home * 500));
    await page
      .getByRole("button", { name: "Lock in guess", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Next home", exact: true }),
    ).toBeVisible();
    if (home < 2)
      await page
        .getByRole("button", { name: "Next home", exact: true })
        .click();
  }
  await page.screenshot({
    path: "test-results/mobile-play.png",
    fullPage: true,
  });
  await expect(page.locator(".error[role=alert]")).toHaveCount(0);
  await page.goto("/me/guess");
  await page.getByLabel("My monthly guess").fill("4200");
  await page
    .getByRole("link", { name: "Find my closest life", exact: true })
    .click();
  await page.getByRole("link", { name: /Customize starter profile/ }).click();
  await page.getByLabel("Monthly take-home pay").fill("6500");
  await page
    .getByRole("button", { name: "Save spending", exact: true })
    .click();
  await expect(page.locator(".notice[role=status]")).toContainText(
    "Profile saved",
  );
  await page.goto("/future");
  await expect(
    page.getByRole("img", {
      name: "Ten-year net worth forecast with estimated input range",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-future.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/me/upload");
  await page
    .getByLabel("Statement CSV", { exact: true })
    .setInputFiles(path.resolve("packages/data/fixtures/statement.sample.csv"));
  await expect(
    page.getByRole("button", { name: "Save category totals", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save category totals", exact: true })
    .click();
  await expect(page.locator(".notice[role=status]")).toContainText(
    /totals saved|category totals|refined/i,
  );
  await page.goto("/loan");
  await page
    .getByRole("button", { name: "Compare loans", exact: true })
    .click();
  await expect(page.getByText("Interest:", { exact: false })).toHaveCount(3);
  await expect(page.locator(".error[role=alert]")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Compare loans", exact: true }),
  ).toBeVisible();
});

test("anonymous debt edits, wishlist and forecast gate persist", async ({
  page,
}) => {
  await page.goto("/pro");
  await expect(
    page.getByRole("heading", { name: "See your forecast first", exact: true }),
  ).toBeVisible();
  await page.goto("/me/balance");
  await expect(
    page.getByRole("button", { name: "Add debt", exact: true }),
  ).toBeVisible();
  const before = await page
    .getByRole("button", { name: /Remove debt \d+/ })
    .count();
  await page.getByRole("button", { name: "Add debt", exact: true }).click();
  await page
    .getByLabel(`Debt ${before + 1} balance`, { exact: true })
    .fill("1234");
  await page.getByLabel(`Debt ${before + 1} APR`, { exact: true }).fill("0.12");
  await page
    .getByRole("button", { name: "Save balances", exact: true })
    .click();
  await expect(page.locator(".notice[role=status]")).toContainText(
    "Profile saved",
  );
  await page.reload();
  await expect(
    page.getByLabel(`Debt ${before + 1} balance`, { exact: true }),
  ).toHaveValue("1234");
  await page.goto("/afford");
  await page.getByLabel("Purchase", { exact: true }).fill("Test bicycle");
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test bicycle", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Test bicycle", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check affordability", exact: true })
    .click();
  await expect(page.locator(".result h2")).toHaveText(/fits|wait|no/);
  await page.goto("/future");
  await expect(
    page.getByRole("img", {
      name: "Ten-year net worth forecast with estimated input range",
    }),
  ).toBeVisible();
  await page.goto("/pro");
  await expect(
    page.getByText("Interactive concept · not a live service", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".error[role=alert]")).toHaveCount(0);
});
