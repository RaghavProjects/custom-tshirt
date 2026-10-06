import { test, expect } from "@playwright/test";

async function firstProductAndColor(page: import("@playwright/test").Page) {
  await page.goto("/");
  const card = page.locator('[data-testid^="product-"]').first();
  const productId = (await card.getAttribute("data-testid"))!.replace(
    "product-",
    "",
  );
  const swatch = page.locator('[data-testid^="color-"]').first();
  const colorHex = (await swatch.getAttribute("data-testid"))!.replace(
    "color-",
    "",
  );
  return { productId, colorHex };
}

test("the order API rejects an empty payload and names the problems", async ({
  request,
}) => {
  const res = await request.post("/api/orders", { data: {} });
  expect(res.status()).toBe(400);
  const body = (await res.json()) as {
    error: string;
    fields: { path: string }[];
  };
  expect(body.error).toBe("Invalid order");
  expect(body.fields.length).toBeGreaterThan(0);
});

test("an order for a product with no owner price is refused, not faked", async ({
  page,
  request,
}) => {
  const { productId, colorHex } = await firstProductAndColor(page);

  const res = await request.post("/api/orders", {
    data: {
      productId,
      colorHex,
      quantity: 1,
      sizeBreakdown: { M: 1 },
      printMethod: "dtf",
      customer: { name: "Asha", phone: "9999999999", email: "a@example.com" },
      shipping: { line1: "1 MG Road", city: "Jaipur", pincode: "302001" },
      design: {
        shirtColor: colorHex,
        front: [
          {
            id: "el-1",
            kind: "text",
            content: "Hello",
            fontFamily: "Arial",
            fill: "#ffffff",
            fontSize: 24,
            x: 10,
            y: 10,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
        ],
        back: [],
      },
    },
  });

  expect(res.status()).toBe(409);
  const body = (await res.json()) as { error: string };
  expect(body.error).toContain("Pricing is not configured");
});
