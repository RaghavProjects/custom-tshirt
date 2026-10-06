import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const API = process.env.PHASE7_API ?? "http://localhost:3000";
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "sandbox-dev-secret";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!url || !key) throw new Error("Missing Supabase env");
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.log(
    "SKIP: set ADMIN_EMAIL and ADMIN_PASSWORD in .env.local to run the admin checks.",
  );
  process.exit(0);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const sign = (b) => crypto.createHmac("sha256", SECRET).update(b).digest("hex");

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const created = { productId: null, orderIds: [], userId: null };

try {
  // ensure the admin user exists (idempotent)
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === ADMIN_EMAIL);
  if (found) {
    created.userId = found.id;
  } else {
    const { data: made, error } = await admin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    created.userId = made.user.id;
  }

  const allow = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  check(
    "ADMIN_EMAILS allowlist includes the admin account",
    allow.includes(ADMIN_EMAIL.toLowerCase()),
    `allowlist=${JSON.stringify(allow)}`,
  );

  // throwaway product + temporary price so an order can be created
  const { data: product } = await admin
    .from("products")
    .insert({ name: "__phase7_test__", category: "tee", base_price: 600 })
    .select("id")
    .single();
  created.productId = product.id;
  await admin
    .from("product_colors")
    .insert({ product_id: product.id, name: "Test", hex: "#334455" });
  await admin
    .from("product_sizes")
    .insert({ product_id: product.id, label: "M", sort_order: 1 });
  await admin
    .from("settings")
    .update({ data: { bulk_price_breaks: [{ min_qty: 1, unit_price: 600 }] } })
    .eq("id", 1);

  const element = {
    id: "el-1",
    kind: "text",
    content: "Admin",
    fontFamily: "Arial",
    fill: "#ffffff",
    fontSize: 24,
    x: 10,
    y: 10,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };
  const orderRes = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      colorHex: "#334455",
      quantity: 1,
      sizeBreakdown: { M: 1 },
      printMethod: "dtf",
      customer: { name: "Asha", phone: "9999999999", email: "a@example.com" },
      shipping: { line1: "1 MG Road", city: "Jaipur", pincode: "302001" },
      design: { shirtColor: "#334455", front: [element], back: [] },
    }),
  });
  const orderBody = await orderRes.json();
  const orderId = orderBody.orderId;
  created.orderIds = [orderId];
  check("a test order exists to work on", orderRes.status === 201, `status=${orderRes.status}`);

  // sign in as admin -> cookie
  const login = await fetch(`${API}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
  check(
    "admin signs in and receives a session cookie",
    login.status === 200 && cookie.startsWith("admin_token="),
    `status=${login.status}`,
  );

  // wrong password is refused
  const badLogin = await fetch(`${API}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: "wrong-password" }),
  });
  check("a wrong password is refused (401)", badLogin.status === 401, `status=${badLogin.status}`);

  // illegal transition before payment
  const jump = await fetch(`${API}/api/admin/orders/${orderId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ to: "in_production" }),
  });
  check(
    "an unpaid order cannot enter production (409)",
    jump.status === 409,
    `status=${jump.status}`,
  );

  // pay via the sandbox gateway
  await fetch(`${API}/api/payments/sandbox/pay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderIds: [orderId] }),
  });

  // legal chain: paid -> in_production -> printed -> shipped
  const chain = ["in_production", "printed", "shipped"];
  const steps = [];
  for (const to of chain) {
    const res = await fetch(`${API}/api/admin/orders/${orderId}/status`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ to }),
    });
    steps.push(res.status);
    const body = await res.json().catch(() => ({}));
    check(`advance to ${to}`, res.status === 200 && body.status === to, `status=${res.status}`);
  }

  // skipping a step is refused
  const skip = await fetch(`${API}/api/admin/orders/${orderId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ to: "printed" }),
  });
  check(
    "shipped is terminal; moving again is refused (409)",
    skip.status === 409,
    `status=${skip.status}`,
  );

  // every move is logged
  const { data: events } = await admin
    .from("order_status_events")
    .select("from_state,to_state,actor")
    .eq("order_id", orderId);
  check(
    "all three moves are logged with an actor",
    events?.length === 3 && events.every((e) => e.actor === ADMIN_EMAIL),
    `events=${events?.length}`,
  );

  // design file download with the admin cookie
  const dl = await fetch(`${API}/api/admin/orders/${orderId}/design`, {
    headers: { cookie },
  });
  check(
    "the admin can download the design file",
    dl.status === 200 &&
      (dl.headers.get("content-disposition") ?? "").includes("attachment"),
    `status=${dl.status}`,
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
