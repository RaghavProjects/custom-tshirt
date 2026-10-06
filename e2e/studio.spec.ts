import { test, expect, type Page } from "@playwright/test";

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function toStudio(page: Page) {
  await page.goto("/");
  await page.getByTestId("color-#000000").click();
  await page.getByTestId("size-M").click();
  await page.getByTestId("start-designing").click();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
}

async function design(page: Page) {
  const json = await page.getByTestId("design-json").textContent();
  return JSON.parse(json ?? "{}") as {
    front: unknown[];
    back: unknown[];
  };
}

test("add text on the front keeps the back empty", async ({ page }) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  const d = await design(page);
  expect(d.front).toHaveLength(1);
  expect(d.back).toHaveLength(0);
  await expect(page.getByText("Text: Your text")).toBeVisible();
});

test("front and back designs are independent", async ({ page }) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  await page.getByTestId("side-back").click();
  let d = await design(page);
  expect(d.front).toHaveLength(1);
  expect(d.back).toHaveLength(0);

  await page.getByTestId("add-text").click();
  d = await design(page);
  expect(d.front).toHaveLength(1);
  expect(d.back).toHaveLength(1);
});

test("a non-image upload is rejected with a reason and saves nothing", async ({
  page,
}) => {
  await toStudio(page);
  await page.getByTestId("upload-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByTestId("studio-error")).toContainText("Unsupported");
  const d = await design(page);
  expect(d.front).toHaveLength(0);
});

test("a PNG upload is accepted and stored", async ({ request }) => {
  const res = await request.post("/api/upload", {
    multipart: {
      file: {
        name: "art.png",
        mimeType: "image/png",
        buffer: Buffer.from(PNG_1x1, "base64"),
      },
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { url: string };
  expect(body.url).toContain("/artwork/uploads/");
});
