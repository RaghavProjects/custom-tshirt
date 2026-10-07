import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";

async function toStudio(page: Page) {
  await page.goto("/");
  await page.getByTestId("color-#000000").click();
  await page.getByTestId("size-M").click();
  await page.getByTestId("start-designing").click();
  await expect(page.getByTestId("studio-heading")).toBeVisible();
}

function imageElementUrl(json: string): string | null {
  const parsed = JSON.parse(json) as {
    front: { kind: string; url?: string }[];
  };
  return parsed.front.find((e) => e.kind === "image")?.url ?? null;
}

// Downloads a WASM model on first run, so allow plenty of time.
test("background removal yields a transparent PNG", async ({ page, request }) => {
  test.setTimeout(300_000);

  await toStudio(page);

  // a red circle on a white background
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">' +
    '<rect width="256" height="256" fill="#ffffff"/>' +
    '<circle cx="128" cy="128" r="90" fill="#d02020"/></svg>';
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  await page.getByTestId("upload-input").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: png,
  });

  // wait until the uploaded image element is in the design
  await expect
    .poll(
      async () =>
        imageElementUrl(
          (await page.getByTestId("design-json").textContent()) ?? "{}",
        ),
      { timeout: 60_000 },
    )
    .toBeTruthy();

  // the freshly uploaded element is selected, so the tool is available
  const before = imageElementUrl(
    (await page.getByTestId("design-json").textContent()) ?? "{}",
  );
  expect(before).toBeTruthy();

  const removeBtn = page.getByTestId("remove-bg");
  await expect(removeBtn).toBeVisible();
  await removeBtn.click();

  // wait for the element url to change to the processed upload
  await expect
    .poll(
      async () =>
        imageElementUrl(
          (await page.getByTestId("design-json").textContent()) ?? "{}",
        ),
      { timeout: 240_000, intervals: [1000, 2000, 5000] },
    )
    .not.toBe(before);

  const error = await page.getByTestId("studio-error").count();
  expect(error, "no error banner").toBe(0);

  const after = imageElementUrl(
    (await page.getByTestId("design-json").textContent()) ?? "{}",
  )!;
  const res = await request.get(after);
  expect(res.status()).toBe(200);
  const buf = Buffer.from(await res.body());
  const stats = await sharp(buf).stats();
  const alpha = stats.channels[3];
  const red = stats.channels[0];
  // background removed (fully transparent pixels exist) while the red subject
  // is retained (near-opaque pixels and strong red still present)
  expect(alpha.min).toBe(0);
  expect(alpha.max).toBeGreaterThanOrEqual(250);
  expect(red.max).toBeGreaterThan(150);
});
