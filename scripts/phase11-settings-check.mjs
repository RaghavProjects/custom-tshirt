import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const API = process.env.PHASE11_API ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!url || !key) throw new Error("Missing Supabase env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log("SKIP: set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local.");
  process.exit(0);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const { data: products } = await admin
  .from("products")
  .select("id,name,base_price")
  .eq("active", true);
const { data: settingsRow } = await admin
  .from("settings")
  .select("data")
  .eq("id", 1)
  .single();
const originalData = settingsRow.data;

try {
  const login = await fetch(`${API}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  check("admin signs in", login.status === 200, `status=${login.status}`);

  const payload = {
    products: products.map((p) => ({ id: p.id, basePrice: 360 })),
    bulkPriceBreaks: [
      { minQty: 1, unitPrice: 360 },
      { minQty: 12, unitPrice: 300 },
    ],
    artwork: {
      acceptedTypes: ["image/png", "image/jpeg"],
      maxFileSizeMb: 8,
      minResolutionDpi: 200,
    },
    printArea: { x: 110, y: 100, width: 320, height: 400 },
    shippingFlat: 60,
  };

  const res = await fetch(`${API}/api/admin/settings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(payload),
  });
  check("settings save returns ok", res.status === 200, `status=${res.status}`);

  const { data: after } = await admin
    .from("products")
    .select("base_price")
    .eq("active", true);
  check(
    "every product price was updated",
    (after ?? []).every((p) => p.base_price === 360),
    JSON.stringify((after ?? []).map((p) => p.base_price)),
  );

  const { data: d } = await admin
    .from("settings")
    .select("data")
    .eq("id", 1)
    .single();
  const data = d.data;
  check(
    "bulk tiers saved",
    Array.isArray(data.bulk_price_breaks) &&
      data.bulk_price_breaks[1]?.unit_price === 300,
    JSON.stringify(data.bulk_price_breaks),
  );
  check(
    "artwork rules saved (8 MB, 200 dpi)",
    data.artwork_rules?.max_file_size_bytes === 8 * 1024 * 1024 &&
      data.artwork_rules?.min_resolution_dpi === 200,
    JSON.stringify(data.artwork_rules),
  );
  check(
    "print area saved",
    data.print_areas?.front?.width === 320 && data.print_areas?.front?.height === 400,
    JSON.stringify(data.print_areas),
  );
  check(
    "other owner slots preserved (price_per_color key still present)",
    Object.prototype.hasOwnProperty.call(data, "price_per_color"),
  );

  // invalid payload is refused
  const bad = await fetch(`${API}/api/admin/settings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ ...payload, printArea: { ...payload.printArea, width: 0 } }),
  });
  check("an invalid print area is refused (400)", bad.status === 400, `status=${bad.status}`);
} finally {
  // restore exactly what was there before
  for (const p of products) {
    await admin.from("products").update({ base_price: p.base_price }).eq("id", p.id);
  }
  await admin.from("settings").update({ data: originalData }).eq("id", 1);
  console.log("cleanup done");
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
