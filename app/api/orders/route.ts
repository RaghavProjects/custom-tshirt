import { NextResponse, type NextRequest } from "next/server";
import { issuesOf, orderSchema } from "@/lib/orders";
import { orderTotal, unitPriceFor } from "@/lib/pricing";
import { getStudioSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";

function assetUrls(
  front: { kind: string; url?: string }[],
  back: { kind: string; url?: string }[],
): string[] {
  return [...front, ...back]
    .filter((e) => e.kind === "image" && typeof e.url === "string")
    .map((e) => e.url as string);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    // Rejected: nothing is written (AGENTS.md §3).
    return NextResponse.json(
      { error: "Invalid order", fields: issuesOf(parsed.error) },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const admin = supabaseAdmin();

  // Product must exist and its colour/sizes must match the catalogue.
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,base_price, product_colors(hex), product_sizes(label)")
    .eq("id", input.productId)
    .eq("active", true)
    .single();

  if (productError || !product) {
    return NextResponse.json({ error: "Unknown product" }, { status: 404 });
  }

  const colors = (product.product_colors ?? []) as { hex: string }[];
  const sizes = (product.product_sizes ?? []) as { label: string }[];

  if (!colors.some((c) => c.hex.toLowerCase() === input.colorHex.toLowerCase())) {
    return NextResponse.json(
      { error: "Colour is not available for this product" },
      { status: 400 },
    );
  }
  const knownSizes = new Set(sizes.map((s) => s.label));
  const unknownSize = Object.keys(input.sizeBreakdown).find(
    (s) => !knownSizes.has(s),
  );
  if (unknownSize) {
    return NextResponse.json(
      { error: `Unknown size "${unknownSize}" for this product` },
      { status: 400 },
    );
  }

  const settings = await getStudioSettings();
  const unitPrice = unitPriceFor(
    product.base_price,
    input.quantity,
    settings.bulkPriceBreaks,
  );
  const total = orderTotal(unitPrice, input.quantity);

  if (unitPrice === null || total === null) {
    // The owner has not set prices yet — we do not invent a number.
    return NextResponse.json(
      {
        error:
          "Pricing is not configured for this product yet. The owner needs to set prices.",
      },
      { status: 409 },
    );
  }

  const { data: design, error: designError } = await admin
    .from("designs")
    .insert({
      shirt_color: input.colorHex,
      front_elements: input.design.front,
      back_elements: input.design.back,
      asset_urls: assetUrls(input.design.front, input.design.back),
    })
    .select("id")
    .single();

  if (designError || !design) {
    return NextResponse.json(
      { error: `Could not save the design: ${designError?.message}` },
      { status: 500 },
    );
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      design_id: design.id,
      quantity: input.quantity,
      size_breakdown: input.sizeBreakdown,
      print_method: input.printMethod,
      unit_price: unitPrice,
      total_price: total,
      customer: input.customer,
      shipping: input.shipping,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: `Could not save the order: ${orderError?.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { orderId: order.id, unitPrice, total, status: "pending_payment" },
    { status: 201 },
  );
}
