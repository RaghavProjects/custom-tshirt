import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getAdminUser } from "@/lib/admin";
import type { DesignElement } from "@/lib/design";
import {
  compositePosition,
  computeOutputSize,
  designToSvg,
  PLACEHOLDER_PRINT_DPI,
  textLayerSvg,
} from "@/lib/print";
import { getStudioSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";

const STAGE_DPI = 72;

async function fetchBytes(url: string): Promise<Buffer | null> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1] ?? "";
    return Buffer.from(base64, "base64");
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function renderPng(
  elements: DesignElement[],
  printArea: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  const dpi = PLACEHOLDER_PRINT_DPI;
  const scale = dpi / STAGE_DPI;
  const { width, height } = computeOutputSize(printArea, dpi);

  // Text renders through SVG (reliable with sharp's renderer).
  const textSvg = textLayerSvg({ printArea, elements, dpi });
  let baseBuf = await sharp(Buffer.from(textSvg)).png().toBuffer();

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const el of elements) {
    if (el.kind !== "image") continue;
    const bytes = await fetchBytes(el.url);
    if (!bytes) continue;

    const targetW = Math.max(1, Math.round(el.width * el.scaleX * scale));
    const targetH = Math.max(1, Math.round(el.height * el.scaleY * scale));

    let pipeline = sharp(bytes).resize(targetW, targetH, { fit: "fill" });
    let rotatedWidth = targetW;
    let rotatedHeight = targetH;

    if (el.rotation) {
      const resized = await pipeline.png().toBuffer();
      const rotated = sharp(resized).rotate(el.rotation, {
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
      const rotatedBuf = await rotated.png().toBuffer();
      const meta = await sharp(rotatedBuf).metadata();
      rotatedWidth = meta.width ?? targetW;
      rotatedHeight = meta.height ?? targetH;
      pipeline = sharp(rotatedBuf);
    }

    const input = await pipeline.png().toBuffer();
    const { left, top } = compositePosition({
      el,
      printArea,
      rotatedWidth,
      rotatedHeight,
      dpi,
    });

    composites.push({
      input,
      left: Math.max(0, Math.round(left)),
      top: Math.max(0, Math.round(top)),
    });
  }

  if (composites.length > 0) {
    baseBuf = await sharp(baseBuf).composite(composites).png().toBuffer();
  }

  // Guard: never hand back a smaller canvas than expected.
  const meta = await sharp(baseBuf).metadata();
  if (meta.width !== width || meta.height !== height) {
    baseBuf = await sharp(baseBuf)
      .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  return baseBuf;
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") === "svg" ? "svg" : "png";

  const { data } = await supabaseAdmin()
    .from("orders")
    .select("id,designs(front_elements,back_elements)")
    .eq("id", id)
    .single();

  if (!data) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  const design = data.designs as unknown as {
    front_elements: DesignElement[];
    back_elements: DesignElement[];
  } | null;

  const elements = [
    ...(design?.front_elements ?? []),
    ...(design?.back_elements ?? []),
  ];

  const settings = await getStudioSettings();

  if (format === "svg") {
    const svg = designToSvg({ printArea: settings.printArea, elements });
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "content-disposition": `attachment; filename="print-${id}.svg"`,
      },
    });
  }

  try {
    const png = await renderPng(elements, settings.printArea);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "content-disposition": `attachment; filename="print-${id}.png"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not render the print file: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
