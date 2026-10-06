import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const API = process.env.PHASE8_API ?? "http://localhost:3000";
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

const created = { productId: null, orderIds: [], uploadPath: null };

try {
  // a real, red artwork uploaded through the app
  const red = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 220, g: 30, b: 30, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append("file", new Blob([red], { type: "image/png" }), "art.png");
  const upload = await fetch(`${API}/api/upload`, { method: "POST", body: form });
  const uploadBody = await upload.json();
  created.uploadPath = uploadBody.path;
  check("artwork uploads through the app", upload.status === 201, `status=${upload.status}`);

  const { data: product } = await admin
    .from("products")
    .insert({ name: "__phase8_test__", category: "tee", base_price: 700 })
    .select("id")
    .single();
  created.productId = product.id;
  await admin
    .from("product_colors")
    .insert({ product_id: product.id, name: "Test", hex: "#445566" });
  await admin
    .from("product_sizes")
    .insert({ product_id: product.id, label: "M", sort_order: 1 });
  await admin
    .from("settings")
    .update({ data: { bulk_price_breaks: [{ min_qty: 1, unit_price: 700 }] } })
    .eq("id", 1);

  const text = {
    id: "el-1",
    kind: "text",
    content: "Print me",
    fontFamily: "Arial",
    fill: "#000000",
    fontSize: 40,
    x: 140,
    y: 120,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };
  const image = {
    id: "el-2",
    kind: "image",
    url: uploadBody.url,
    x: 150,
    y: 200,
    width: 120,
    height: 120,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
  };

  const orderRes = await fetch(`${API}/api/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productId: product.id,
      colorHex: "#445566",
      quantity: 1,
      sizeBreakdown: { M: 1 },
      printMethod: "dtf",
      customer: { name: "Asha", phone: "9999999999", email: "a@example.com" },
      shipping: { line1: "1 MG Road", city: "Jaipur", pincode: "302001" },
      design: { shirtColor: "#445566", front: [text, image], back: [] },
    }),
  });
  const { orderId } = await orderRes.json();
  created.orderIds = [orderId];

  const login = await fetch(`${API}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";

  const unauth = await fetch(`${API}/api/admin/orders/${orderId}/print?format=png`);
  check("print file requires admin (401)", unauth.status === 401, `status=${unauth.status}`);

  const pngRes = await fetch(`${API}/api/admin/orders/${orderId}/print?format=png`, {
    headers: { cookie },
  });
  const pngBuf = Buffer.from(await pngRes.arrayBuffer());
  const isPng =
    pngBuf.length > 8 && pngBuf[0] === 0x89 && pngBuf.toString("ascii", 1, 4) === "PNG";
  check(
    "PNG print file is a real PNG",
    pngRes.status === 200 &&
      (pngRes.headers.get("content-type") ?? "").includes("image/png") &&
      isPng,
    `status=${pngRes.status} bytes=${pngBuf.length}`,
  );

  const meta = await sharp(pngBuf).metadata();
  if (process.env.PHASE8_SAVE) {
    await writeFile(process.env.PHASE8_SAVE, pngBuf);
  }
  check(
    "PNG is rendered at the print resolution",
    meta.width === 1250 && meta.height === 1583,
    `dims=${meta.width}x${meta.height}`,
  );

  const dpiScale = 300 / 72;
  // NOTE: sharp's stats() ignores extract, so crop to a buffer first.
  async function cropStats(buf, x, y, w, h) {
    const crop = await sharp(buf)
      .extract({ left: x, top: y, width: w, height: h })
      .toBuffer();
    return sharp(crop).stats();
  }

  // the artwork region (x 150,y 200, 120x120 in stage units)
  const imgCrop = await cropStats(
    pngBuf,
    Math.round((150 - 110) * dpiScale),
    Math.round((200 - 100) * dpiScale),
    Math.round(120 * dpiScale),
    Math.round(120 * dpiScale),
  );
  const redMean = imgCrop.channels[0].mean;
  const alphaMean = imgCrop.channels[3] ? imgCrop.channels[3].mean : 255;
  check(
    "uploaded artwork is composited into the print file",
    redMean > 180 && alphaMean > 200,
    `redMean=${redMean.toFixed(1)} alphaMean=${alphaMean.toFixed(1)}`,
  );

  // the text region (x 140,y 120)
  const textCrop = await cropStats(
    pngBuf,
    Math.round((140 - 110) * dpiScale),
    Math.round((120 - 100) * dpiScale),
    Math.round(200 * dpiScale),
    Math.round(60 * dpiScale),
  );
  const textDarkest = Math.min(...textCrop.channels.slice(0, 3).map((c) => c.min));
  check(
    "text ink is present in the print file",
    textDarkest < 40,
    `darkest=${textDarkest}`,
  );

  // SVG (embroidery) still carries text and the image reference
  const svgRes = await fetch(`${API}/api/admin/orders/${orderId}/print?format=svg`, {
    headers: { cookie },
  });
  const svg = await svgRes.text();
  check(
    "SVG (embroidery) carries the design",
    svgRes.status === 200 &&
      svg.includes("Print me") &&
      svg.includes("<image") &&
      svg.includes('viewBox="0 0 300 380"'),
    `status=${svgRes.status}`,
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
  if (created.uploadPath) {
    await admin.storage.from("artwork").remove([created.uploadPath]);
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
