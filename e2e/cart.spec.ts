import { test, expect, type Page } from "@playwright/test";

async function toStudio(page: Page) {
  await page.goto("/");
  await page.getByTestId("color-#000000").click();
  await page.getByTestId("size-M").click();
  await page.getByTestId("start-designing").click();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
}

test("a designed shirt can be added to the cart and seen there", async ({
  page,
}) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  await page.getByTestId("add-to-cart").click();

  await page.getByRole("link", { name: "View cart" }).click();
  await expect(page.getByTestId("cart-item")).toHaveCount(1);
  await expect(page.getByTestId("cart-count")).toContainText("1 item");
});

test("nothing can be added to the cart without a design", async ({ page }) => {
  await toStudio(page);
  await expect(page.getByTestId("add-to-cart")).toBeDisabled();
});

test("checkout refuses to submit an empty form and shows field errors", async ({
  page,
}) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  await page.getByTestId("add-to-cart").click();
  await page.getByRole("link", { name: "View cart" }).click();
  await page.getByTestId("to-checkout").click();

  await page.getByTestId("place-order").click();
  await expect(page.getByText("name is required")).toBeVisible();
  await expect(page).toHaveURL(/\/checkout/);
});
