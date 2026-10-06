import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const API = process.env.PHASE6_API ?? "http://localhost:3000";
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET;
if (!url || !key) throw new Error("Missing Supabase env");

const admin = createClient(url, key, { auth: { persistSession: false } });

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
const sign = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("hex");

const created = { productId: null, orderIds: [] };

try {
  const { data: product, error: pErr } = await admin
    .from("products")
    .insert({ name: "__phase6_test__", category: "tee", base_price: 500 })
    .select("id")
    .single();
  if (pErr) throw pErr;
  created.productId = product.id;
  await admin
    .from("product_colors")
    .insert({ product_id: product.id, name: "Test", hex: "#223344" });
  await admin
    .from("product_sizes")
    .insert({ product_id: product.id, label: "M", sort_order: 1 });
  await admin
    .from("settings")
    .update({ data: { bulk_price_breaks: [{ min_qty: 1, unit_price: 450 }] } })
    .eq("id", 1);

  const element = {
    id: "el-1",
    kind: "text",
    content: "Hi",
    fontFamily: "Arial",
    fill: "#ffffff",
    fontSize: 24,
    x: 140,
    y: 150,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };
  const item = {
    productId: product.id,
    colorHex: "#223344",
    quantity: 2,
    sizeBreakdown: { M: 2 },
    printMethod: "vinyl",
    design: { shirtColor: "#223344", front: [element], back: [] },
  };

  // checkout creates the order(s)
  const co = await fetch(`${API}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      customer: { name: "Asha", phone: "9999999999", email: "a@example.com" },
      shipping: { line1: "1 MG Road", city: "Jaipur", pincode: "302001" },
      items: [item],
    }),
  });
  const coBody = await co.json();
  created.orderIds = coBody.orderIds ?? [];
  check(
    "checkout creates an unpaid order with server-computed total",
    co.status === 201 && coBody.grandTotal === 900,
    `status=${co.status} grandTotal=${coBody.grandTotal}`,
  );
  const orderId = created.orderIds[0];

  const { data: before } = await admin
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();
  check("order starts unpaid", before?.payment_status === "unpaid", `status=${before?.payment_status}`);

  // bad signature changes nothing
  const badBody = JSON.stringify({ eventId: crypto.randomUUID(), orderId, status: "paid" });
  const badRes = await fetch(`${API}/api/payments/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sandbox-signature": "deadbeef" },
    body: badBody,
  });
  const { data: afterBad } = await admin
    .from("orders")
    .select("payment_status")
    .eq("id", orderId)
    .single();
  check(
    "webhook with a bad signature is rejected and changes nothing",
    badRes.status === 400 && afterBad?.payment_status === "unpaid",
    `status=${badRes.status} payment=${afterBad?.payment_status}`,
  );

  // sandbox gateway emits a signed webhook
  const pay = await fetch(`${API}/api/payments/sandbox/pay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderIds: [orderId] }),
  });
  const payBody = await pay.json();
  const { data: afterPay } = await admin
    .from("orders")
    .select("payment_status,paid_at,payment_event_id")
    .eq("id", orderId)
    .single();
  check(
    "valid signed webhook marks the order paid with an event id",
    pay.status === 200 &&
      afterPay?.payment_status === "paid" &&
      Boolean(afterPay?.paid_at) &&
      Boolean(afterPay?.payment_event_id),
    `payment=${afterPay?.payment_status} event=${afterPay?.payment_event_id?.slice(0, 8)}`,
  );
  const webhookStatus = payBody?.results?.[0]?.body?.email;
  check(
    "webhook reports email outcome honestly (sent or skipped)",
    webhookStatus !== undefined,
    JSON.stringify(webhookStatus),
  );

  // replay the same event: must not act twice
  const evId = afterPay.payment_event_id;
  const replayBody = JSON.stringify({ eventId: evId, orderId, status: "paid" });
  const replayRes = await fetch(`${API}/api/payments/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sandbox-signature": sign(replayBody),
    },
    body: replayBody,
  });
  const replayJson = await replayRes.json();
  const { data: afterReplay } = await admin
    .from("orders")
    .select("payment_event_id")
    .eq("id", orderId)
    .single();
  check(
    "a replayed webhook does not act twice",
    replayRes.status === 200 &&
      replayJson.duplicate === true &&
      afterReplay?.payment_event_id === evId,
    `status=${replayRes.status} duplicate=${replayJson.duplicate}`,
  );

  // the order carried its design
  const { data: ord } = await admin
    .from("orders")
    .select("designs(front_elements)")
    .eq("id", orderId)
    .single();
  check(
    "the paid order carries its design",
    Array.isArray(ord?.designs?.front_elements) &&
      ord.designs.front_elements.length === 1,
  );
} finally {
  if (created.orderIds.length) {
    const { data } = await admin
      .from("orders")
      .select("design_id")
      .in("id", created.orderIds);
    const designIds = (data ?? []).map((r) => r.design_id).filter(Boolean);
    await admin.from("order_status_events").delete().in("order_id", created.orderIds);
    await admin.from("orders").delete().in("id", created.orderIds);
    if (designIds.length) await admin.from("designs").delete().in("id", designIds);
  }
  if (created.productId) {
    await admin.from("product_sizes").delete().eq("product_id", created.productId);
    await admin.from("product_colors").delete().eq("product_id", created.productId);
    await admin.from("products").delete().eq("id", created.productId);
  }
  await admin
    .from("settings")
    .update({
      data: {
        bulk_price_breaks: null,
        artwork_rules: { accepted_types: null, max_file_size_bytes: null, min_resolution_dpi: null },
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
