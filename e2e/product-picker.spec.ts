import { test, expect } from "@playwright/test";

test("picker requires a colour and a size before the studio", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Design your own T-shirt" }),
  ).toBeVisible();

  const cta = page.getByTestId("start-designing");
  await expect(cta).toBeDisabled();

  await page.getByTestId("color-#000000").click();
  await expect(cta, "still blocked without a size").toBeDisabled();

  await page.getByTestId("size-M").click();
  await expect(cta).toBeEnabled();

  await cta.click();
  await expect(page).toHaveURL(/\/studio\?product=.+&color=%23000000&size=M/);
  await expect(page.getByTestId("studio-size")).toHaveText("M");

  await page.screenshot({
    path: `test-results/evidence/studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("changing product clears the previous colour and size", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("color-#000000").click();
  await page.getByTestId("size-M").click();
  const cta = page.getByTestId("start-designing");
  await expect(cta).toBeEnabled();

  const cards = page.locator('[data-testid^="product-"]');
  expect(await cards.count()).toBeGreaterThan(1);
  await cards.nth(1).click();
  await expect(
    cta,
    "a new product must not inherit the old colour/size",
  ).toBeDisabled();
});
