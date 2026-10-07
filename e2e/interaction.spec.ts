import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

async function toStudio(page: Page) {
  await page.goto("/");
  await page.getByTestId("color-#000000").click();
  await page.getByTestId("size-M").click();
  await page.getByTestId("start-designing").click();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
}

type El = { kind: string; x: number; y: number; width?: number; height?: number };
async function front(page: Page): Promise<El[]> {
  const j = JSON.parse(
    (await page.getByTestId("design-json").textContent()) ?? "{}",
  ) as { front: El[] };
  return j.front;
}

/** Canvas offset + scale so stage coordinates map to page coordinates. */
async function geom(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 520;
  return (x: number, y: number) => ({
    x: box.x + x * scale,
    y: box.y + y * scale,
  });
}

async function selectMoveRemove(
  page: Page,
  kind: string,
  point: { x: number; y: number },
  start: El,
) {
  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId("remove-element"), `${kind} select`).toBeVisible();

  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(point.x + 60, point.y + 40, { steps: 8 });
  await page.waitForTimeout(80);
  await page.mouse.up();

  await expect
    .poll(
      async () => {
        const e = (await front(page)).find((x) => x.kind === kind)!;
        return `${e.x},${e.y}`;
      },
      { timeout: 5000, message: `${kind} should move` },
    )
    .not.toBe(`${start.x},${start.y}`);

  await page.getByTestId("remove-element").click();
  expect((await front(page)).some((e) => e.kind === kind)).toBe(false);
}

test("a text element can be selected, moved and removed", async ({ page }) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  const el = (await front(page)).find((e) => e.kind === "text")!;
  const at = await geom(page);
  // click the middle of the text (away from the transformer corner handles)
  await selectMoveRemove(page, "text", at(el.x + 55, el.y + 14), el);
});

test("an image element can be selected, moved and removed", async ({ page }) => {
  await toStudio(page);
  const buf = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 4,
      background: { r: 200, g: 50, b: 50, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const uri = `data:image/png;base64,${buf.toString("base64")}`;
  await page.route("**/api/ai/generate", (r) =>
    r.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ url: uri }),
    }),
  );
  await page.getByTestId("ai-prompt").fill("a ginger cat");
  await page.getByTestId("ai-generate").click();
  await expect.poll(async () => (await front(page)).length).toBe(1);

  const el = (await front(page)).find((e) => e.kind === "image")!;
  const at = await geom(page);
  await selectMoveRemove(
    page,
    "image",
    at(el.x + (el.width ?? 150) / 2, el.y + (el.height ?? 150) / 2),
    el,
  );
});

test("Clear all empties the canvas and it stays empty after reload", async ({
  page,
}) => {
  await toStudio(page);
  await page.getByTestId("add-text").click();
  expect((await front(page)).length).toBe(1);

  await page.getByTestId("clear-design").click();
  expect((await front(page)).length).toBe(0);

  await page.reload();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
  expect((await front(page)).length).toBe(0);
});
