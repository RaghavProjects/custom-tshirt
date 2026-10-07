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

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("AI tool surfaces the not-configured message", async ({ page }) => {
  // Deterministic: mock the API so the test does not depend on a provider key.
  await page.route("**/api/ai/generate", (route) =>
    route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "AI design generation is not configured yet. Add an image-provider key to enable it.",
        configured: false,
      }),
    }),
  );

  await toStudio(page);
  await page.getByTestId("ai-prompt").fill("a ginger cat wearing sunglasses");
  await page.getByTestId("ai-generate").click();
  await expect(page.getByTestId("ai-notice")).toContainText("not configured");
});

test("a generated image is added to the canvas", async ({ page }) => {
  await page.route("**/api/ai/generate", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ url: `data:image/png;base64,${PNG_1x1}` }),
    }),
  );

  await toStudio(page);
  await page.getByTestId("ai-prompt").fill("a ginger cat");
  await page.getByTestId("ai-generate").click();

  await expect
    .poll(async () => {
      const json = await page.getByTestId("design-json").textContent();
      const parsed = JSON.parse(json ?? "{}") as {
        front: { kind: string }[];
      };
      return parsed.front.filter((e) => e.kind === "image").length;
    })
    .toBe(1);
});
