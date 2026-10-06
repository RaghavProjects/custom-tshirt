import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};

/**
 * Stream an artwork object from the private storage bucket. Artwork needs to be
 * viewable by the customer designing (no accounts), so this route is public,
 * but it only serves objects by their unguessable path and never lists them.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const key = path.join("/");

  if (!key.startsWith("uploads/") && !key.startsWith("ai/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin()
    .storage.from("artwork")
    .download(key);

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const bytes = Buffer.from(await data.arrayBuffer());

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
