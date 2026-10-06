import { getPaymentProvider } from "@/lib/payments/provider";
import { orderTotal, unitPriceFor } from "@/lib/pricing";
import { getStudioSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";
import { elementBox, isBoxInsideArea } from "@/lib/design";
import type { OrderInput } from "@/lib/orders";

export type CreateResult =
  | {
      ok: true;
      orderId: string;
      unitPrice: number;
      total: number;
      payUrl: string;
    }
  | { ok: false; status: number; error: string };

function assetUrls(
  front: { kind: string; url?: string }[],
  back: { kind: string; url?: string }[],
): string[] {
  return [...front, ...back]
    .filter((e) => e.kind === "image" && typeof e.url === "string")
    .map((e) => e.url as string);
}

/**
 * Validate against the catalogue, price server-side, then save the design and
 * the order (unpaid) and open a payment intent. Nothing is invented: if the
 * owner has no price, it refuses.
 */
export async function createOrder(input: OrderInput): Promise<CreateResult> {
  const admin = supabaseAdmin();

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,base_price, product_colors(hex), product_sizes(label)")
    .eq("id", input.productId)
    .eq("active", true)
    .single();

  if (productError || !product) {
    return { ok: false, status: 404, error: "Unknown product" };
  }

  const colors = (product.product_colors ?? []) as { hex: string }[];
  const sizes = (product.product_sizes ?? []) as { label: string }[];

  if (!colors.some((c) => c.hex.toLowerCase() === input.colorHex.toLowerCase())) {
    return { ok: false, status: 400, error: "Colour is not available for this product" };
  }
  const knownSizes = new Set(sizes.map((s) => s.label));
  const unknownSize = Object.keys(input.sizeBreakdown).find(
    (s) => !knownSizes.has(s),
  );
  if (unknownSize) {
    return {
      ok: false,
      status: 400,
      error: `Unknown size "${unknownSize}" for this product`,
    };
  }

  const settings = await getStudioSettings();

  // The print area is enforced server-side too, not only by the canvas clamp:
  // art outside it would be silently clipped out of the print file.
  const outside = [...input.design.front, ...input.design.back].find(
    (el) => !isBoxInsideArea(elementBox(el), settings.printArea),
  );
  if (outside) {
    return {
      ok: false,
      status: 400,
      error: "A design element is outside the printable area.",
    };
  }

  const unitPrice = unitPriceFor(
    product.base_price,
    input.quantity,
    settings.bulkPriceBreaks,
  );
  const total = orderTotal(unitPrice, input.quantity);

  if (unitPrice === null || total === null) {
    return {
      ok: false,
      status: 409,
      error:
        "Pricing is not configured for this product yet. The owner needs to set prices.",
    };
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
    return {
      ok: false,
      status: 500,
      error: `Could not save the design: ${designError?.message}`,
    };
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
    await admin.from("designs").delete().eq("id", design.id);
    return {
      ok: false,
      status: 500,
      error: `Could not save the order: ${orderError?.message}`,
    };
  }

  const provider = getPaymentProvider();
  const intent = await provider.createIntent({
    orderId: order.id,
    amount: total,
    currency: "INR",
  });

  await admin
    .from("orders")
    .update({ payment_provider: provider.name, payment_ref: intent.reference })
    .eq("id", order.id);

  return {
    ok: true,
    orderId: order.id,
    unitPrice,
    total,
    payUrl: intent.redirectUrl,
  };
}
