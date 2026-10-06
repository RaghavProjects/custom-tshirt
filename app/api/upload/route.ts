import { NextResponse, type NextRequest } from "next/server";
import { validateArtwork } from "@/lib/artwork";
import { getStudioSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};
// Allowance for multipart framing so the body cap is not exactly the file cap.
const MULTIPART_OVERHEAD = 16 * 1024;

export async function POST(request: NextRequest) {
  const settings = await getStudioSettings();
  const maxBytes = settings.artworkRules.maxFileSizeBytes;

  // Reject oversized bodies before buffering the whole multipart payload.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes + MULTIPART_OVERHEAD) {
    return NextResponse.json(
      { error: "Upload is larger than the allowed limit." },
      { status: 413 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const check = validateArtwork({ type: file.type, size: file.size }, settings.artworkRules);
  if (!check.ok) {
    // Rejected: nothing is written anywhere (AGENTS.md §3).
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const ext = EXT[file.type];
  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabaseAdmin()
    .storage.from("artwork")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Served through our own proxy, so the bucket itself can stay private.
  return NextResponse.json({ url: `/api/artwork/${path}`, path }, { status: 201 });
}
