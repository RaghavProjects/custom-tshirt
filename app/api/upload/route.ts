import { NextResponse, type NextRequest } from "next/server";
import { validateArtwork } from "@/lib/artwork";
import { getStudioSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const settings = await getStudioSettings();
  const check = validateArtwork(
    { type: file.type, size: file.size },
    settings.artworkRules,
  );

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

  const { data } = supabaseAdmin().storage.from("artwork").getPublicUrl(path);

  return NextResponse.json({ url: data.publicUrl, path }, { status: 201 });
}
