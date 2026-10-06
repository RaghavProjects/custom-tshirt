import { NextResponse, type NextRequest } from "next/server";
import {
  IMAGE_GEN_DISABLED_MESSAGE,
  isImageGenConfigured,
} from "@/lib/imagegen";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Generate a design image from a text prompt.
 *
 * The live provider path is UNVERIFIED: no provider key is configured, so the
 * adapter has never been exercised. When no key is set this returns 501 with a
 * clear reason rather than pretending to work.
 */
export async function POST(request: NextRequest) {
  if (!isImageGenConfigured()) {
    return NextResponse.json(
      { error: IMAGE_GEN_DISABLED_MESSAGE, configured: false },
      { status: 501 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
  } | null;
  const prompt = body?.prompt?.trim();
  if (!prompt || prompt.length < 3) {
    return NextResponse.json(
      { error: "A prompt of at least 3 characters is required." },
      { status: 400 },
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Image provider responded ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as {
      data?: { b64_json?: string }[];
    };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "Image provider returned no image." },
        { status: 502 },
      );
    }

    const path = `ai/${crypto.randomUUID()}.png`;
    const { error } = await supabaseAdmin()
      .storage.from("artwork")
      .upload(path, Buffer.from(b64, "base64"), { contentType: "image/png" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: pub } = supabaseAdmin().storage.from("artwork").getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: `Generation failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
