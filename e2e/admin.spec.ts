import { test, expect } from "@playwright/test";

test("the admin area redirects an unauthenticated visitor to sign in", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByTestId("admin-submit")).toBeVisible();
});

test("an order detail page also requires sign-in", async ({ page }) => {
  await page.goto("/admin/orders/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("the admin status API rejects an unauthenticated caller", async ({
  request,
}) => {
  const res = await request.post(
    "/api/admin/orders/00000000-0000-0000-0000-000000000000/status",
    { data: { to: "in_production" } },
  );
  expect(res.status()).toBe(401);
});

test("the admin design download rejects an unauthenticated caller", async ({
  request,
}) => {
  const res = await request.get(
    "/api/admin/orders/00000000-0000-0000-0000-000000000000/design",
  );
  expect(res.status()).toBe(401);
});
