import { test, expect, type Page } from "@playwright/test";

async function toStudio(page: Page) {
  await page.goto("/");
  await page.getByTestId("color-#000000").click();
  await page.getByTestId("size-M").click();
  await page.getByTestId("start-designing").click();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
}

async function frontCount(page: Page): Promise<number> {
  const json = await page.getByTestId("design-json").textContent();
  return (JSON.parse(json ?? "{}") as { front: unknown[] }).front.length;
}

test("a design can be saved, survives reload, and can be loaded back", async ({
  page,
}) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  await page.getByTestId("save-name").fill("Launch tee");
  await page.getByTestId("save-design").click();
  await expect(page.getByTestId("saved-item")).toHaveCount(1);

  await page.reload();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
  await expect(page.getByTestId("saved-item")).toHaveCount(1);

  // change the working design, then load the saved one back
  await page.getByTestId("add-text").click();
  expect(await frontCount(page)).toBe(2);

  await page.locator('[data-testid^="load-saved-"]').first().click();
  expect(await frontCount(page)).toBe(1);

  await page.locator('[data-testid^="delete-saved-"]').first().click();
  await expect(page.getByTestId("saved-item")).toHaveCount(0);
});

test("AI generation reports honestly when no provider is configured", async ({
  page,
}) => {
  await toStudio(page);
  await page.getByTestId("ai-prompt").fill("a ginger cat wearing sunglasses");
  await page.getByTestId("ai-generate").click();
  await expect(page.getByTestId("ai-notice")).toContainText("not configured");
});
