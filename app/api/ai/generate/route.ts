import { NextResponse, type NextRequest } from "next/server";
import {
  IMAGE_GEN_DISABLED_MESSAGE,
  isImageGenConfigured,
} from "@/lib/imagegen";
import { supabaseAdmin } from "@/lib/supabase/server";

const MAX_PROMPT = 1000;

/**
 * Generate a design image from a text prompt via OpenAI's image API.
 *
 * Until a key is configured this returns 501 with a clear reason instead of
 * pretending to work. The live provider path is exercised by
 * scripts/phase10-ai-check.mjs once OPENAI_API_KEY is set.
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
  if (prompt.length > MAX_PROMPT) {
    return NextResponse.json(
      { error: `Prompt is too long (max ${MAX_PROMPT} characters).` },
      { status: 400 },
    );
  }

  // Trim and fall back: an empty or whitespace value must not be sent through.
  const model = (process.env.OPENAI_IMAGE_MODEL ?? "").trim() || "gpt-image-1";

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Image provider responded ${res.status}.`,
          detail: detail.slice(0, 300),
        },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      data?: { b64_json?: string; url?: string }[];
    };
    const item = data.data?.[0];

    let bytes: Buffer | null = null;
    if (item?.b64_json) {
      bytes = Buffer.from(item.b64_json, "base64");
    } else if (item?.url) {
      const imgRes = await fetch(item.url);
      if (imgRes.ok) bytes = Buffer.from(await imgRes.arrayBuffer());
    }

    if (!bytes) {
      return NextResponse.json(
        { error: "Image provider returned no image." },
        { status: 502 },
      );
    }

    const path = `ai/${crypto.randomUUID()}.png`;
    const { error } = await supabaseAdmin()
      .storage.from("artwork")
      .upload(path, bytes, { contentType: "image/png" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Served through our own proxy, like every other artwork upload.
    return NextResponse.json({ url: `/api/artwork/${path}`, path }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: `Generation failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
