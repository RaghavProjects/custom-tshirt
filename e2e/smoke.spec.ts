import { test, expect } from "@playwright/test";

test("home page serves 200 and screenshots at the project width", async ({ page }, testInfo) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({
    path: `test-results/evidence/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
