import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const API = process.env.PHASE5_API ?? "http://localhost:3000";
if (!url || !key) throw new Error("Missing Supabase env");

const admin = createClient(url, key, { auth: { persistSession: false } });

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { productId: null, designIds: [], orderIds: [] };

try {
  // --- throwaway product (never touches the seeded tees) -------------------
  const { data: product, error: pErr } = await admin
    .from("products")
    .insert({ name: "__phase5_test__", category: "tee", base_price: 400 })
    .select("id")
    .single();
  if (pErr) throw pErr;
  created.productId = product.id;

  await admin
    .from("product_colors")
    .insert({ product_id: product.id, name: "Test", hex: "#123456" });
  await admin.from("product_sizes").insert([
    { product_id: product.id, label: "M", sort_order: 1 },
    { product_id: product.id, label: "L", sort_order: 2 },
  ]);

  // temporary owner-style tiers so the tier path is exercised end to end
  await admin
    .from("settings")
    .update({
      data: {
        bulk_price_breaks: [
          { min_qty: 1, unit_price: 350 },
          { min_qty: 12, unit_price: 300 },
        ],
      },
    })
    .eq("id", 1);

  const { count: ordersBefore } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true });

  const element = {
    id: "el-1",
    kind: "text",
    content: "Hello",
    fontFamily: "Arial",
    fill: "#ffffff",
    fontSize: 24,
    x: 140,
    y: 150,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };

  const goodOrder = (quantity, breakdown) => ({
    productId: product.id,
    colorHex: "#123456",
    quantity,
    sizeBreakdown: breakdown,
    printMethod: "dtf",
    customer: { name: "Asha", phone: "9999999999", email: "asha@example.com" },
    shipping: { line1: "1 MG Road", city: "Jaipur", pincode: "302001" },
    design: { shirtColor: "#123456", front: [element], back: [] },
  });

  // --- negative: missing customer name -------------------------------------
  const bad = goodOrder(2, { M: 1, L: 1 });
  bad.customer = { ...bad.customer, name: "" };
  const badRes = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(bad),
  });
  const badBody = await badRes.json();
  const namedField = (badBody.fields ?? []).some(
    (f) => f.path === "customer.name",
  );
  check(
    "invalid order is rejected 400 and names customer.name",
    badRes.status === 400 && namedField,
    `status=${badRes.status} fields=${JSON.stringify(badBody.fields ?? [])}`,
  );

  const { count: ordersAfterBad } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true });
  check(
    "invalid order wrote nothing",
    ordersAfterBad === ordersBefore,
    `before=${ordersBefore} after=${ordersAfterBad}`,
  );

  // --- positive: B2C-small, tier at qty 2 ----------------------------------
  const res2 = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(goodOrder(2, { M: 1, L: 1 })),
  });
  const body2 = await res2.json();
  if (body2.orderId) created.orderIds.push(body2.orderId);
  check(
    "qty 2 order is created with tier price 350 x 2 = 700",
    res2.status === 201 && body2.unitPrice === 350 && body2.total === 700,
    `status=${res2.status} unit=${body2.unitPrice} total=${body2.total}`,
  );

  // --- positive: bulk order at qty 12 uses the 300 tier --------------------
  const res12 = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(goodOrder(12, { M: 6, L: 6 })),
  });
  const body12 = await res12.json();
  if (body12.orderId) created.orderIds.push(body12.orderId);
  check(
    "qty 12 bulk order uses tier 300 x 12 = 3600",
    res12.status === 201 && body12.unitPrice === 300 && body12.total === 3600,
    `status=${res12.status} unit=${body12.unitPrice} total=${body12.total}`,
  );

  // --- the order carries its design ----------------------------------------
  for (const id of created.orderIds) {
    const { data: orderRow } = await admin
      .from("orders")
      .select("design_id, designs(front_elements)")
      .eq("id", id)
      .single();
    if (orderRow?.design_id) created.designIds.push(orderRow.design_id);
    const carriesDesign =
      Array.isArray(orderRow?.designs?.front_elements) &&
      orderRow.designs.front_elements.length === 1;
    check(`order ${id.slice(0, 8)} carries its design`, carriesDesign);
  }
} finally {
  // --- cleanup: leave the database exactly as we found it ------------------
  if (created.orderIds.length) {
    await admin.from("orders").delete().in("id", created.orderIds);
  }
  if (created.designIds.length) {
    await admin.from("designs").delete().in("id", created.designIds);
  }
  if (created.productId) {
    await admin
      .from("product_sizes")
      .delete()
      .eq("product_id", created.productId);
    await admin
      .from("product_colors")
      .delete()
      .eq("product_id", created.productId);
    await admin.from("products").delete().eq("id", created.productId);
  }
  await admin
    .from("settings")
    .update({
      data: {
        bulk_price_breaks: null,
        artwork_rules: {
          accepted_types: null,
          max_file_size_bytes: null,
          min_resolution_dpi: null,
        },
        price_per_color: null,
        print_method_price_difference: null,
        print_areas: null,
        shipping: null,
      },
    })
    .eq("id", 1);
  console.log("cleanup done");
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
