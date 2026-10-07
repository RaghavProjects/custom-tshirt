import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const API = process.env.PHASE10_API ?? "http://localhost:3000";

if (!url || !key) throw new Error("Missing Supabase env");
if (!process.env.OPENAI_API_KEY) {
  console.log(
    "SKIP: set OPENAI_API_KEY in .env.local (and restart the dev server) to verify AI generation.",
  );
  process.exit(0);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

let path = null;

try {
  const res = await fetch(`${API}/api/ai/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "a simple flat vector logo of a ginger root, solid white background",
    }),
  });
  const body = await res.json();
  path = body.path ?? null;
  check(
    "generate returns a stored image",
    res.status === 201 && typeof body.url === "string" && body.url.startsWith("/api/artwork/"),
    `status=${res.status} url=${body.url ?? body.error}`,
  );

  if (body.url) {
    const img = await fetch(`${API}${body.url}`);
    const buf = Buffer.from(await img.arrayBuffer());
    const meta = await sharp(buf).metadata();
    check(
      "the generated image is a real, non-empty image",
      img.status === 200 && (meta.width ?? 0) > 0 && (meta.height ?? 0) > 0,
      `status=${img.status} ${meta.width}x${meta.height} ${meta.format}`,
    );
  }
} finally {
  if (path) {
    await admin.storage.from("artwork").remove([path]);
    console.log("cleanup done");
  }
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
