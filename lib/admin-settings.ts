import { z } from "zod";
import type { PrintArea } from "@/lib/design";
import { PLACEHOLDER_ACCEPTED_TYPES, PLACEHOLDER_MAX_BYTES, PLACEHOLDER_PRINT_AREA } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/server";

const priceBreak = z.object({
  minQty: z.number().int().positive("minimum quantity must be 1 or more"),
  unitPrice: z.number().nonnegative("unit price cannot be negative"),
});

export const adminSettingsSchema = z.object({
  products: z.array(
    z.object({
      id: z.string().uuid(),
      basePrice: z.number().nonnegative().nullable(),
    }),
  ),
  bulkPriceBreaks: z.array(priceBreak),
  artwork: z.object({
    acceptedTypes: z.array(z.string().min(1)).min(1, "keep at least one file type"),
    maxFileSizeMb: z.number().positive(),
    minResolutionDpi: z.number().int().positive().nullable(),
  }),
  printArea: z.object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  shippingFlat: z.number().nonnegative().nullable(),
});

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;

export type AdminSettingsData = {
  products: { id: string; name: string; basePrice: number | null }[];
  bulkPriceBreaks: { minQty: number; unitPrice: number }[];
  artwork: {
    acceptedTypes: string[];
    maxFileSizeMb: number;
    minResolutionDpi: number | null;
  };
  printArea: PrintArea;
  shippingFlat: number | null;
};

type Data = Record<string, unknown>;

export async function getAdminSettings(): Promise<AdminSettingsData> {
  const admin = supabaseAdmin();
  const [productsRes, settingsRes] = await Promise.all([
    admin.from("products").select("id,name,base_price").eq("active", true).order("name"),
    admin.from("settings").select("data").eq("id", 1).single(),
  ]);
  if (productsRes.error) throw productsRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const data = (settingsRes.data?.data ?? {}) as Data;
  const rawBreaks = data.bulk_price_breaks as
    | { min_qty?: number; unit_price?: number }[]
    | null
    | undefined;
  const breaks = Array.isArray(rawBreaks)
    ? rawBreaks
        .filter(
          (b) =>
            typeof b?.min_qty === "number" && typeof b?.unit_price === "number",
        )
        .map((b) => ({ minQty: b.min_qty as number, unitPrice: b.unit_price as number }))
    : [];

  const rules = (data.artwork_rules ?? {}) as {
    accepted_types?: string[] | null;
    max_file_size_bytes?: number | null;
    min_resolution_dpi?: number | null;
  };
  const printAreas = (data.print_areas ?? {}) as { front?: PrintArea };
  const shipping = data.shipping as { flat?: number } | null | undefined;

  return {
    products: (productsRes.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      basePrice: p.base_price as number | null,
    })),
    bulkPriceBreaks: breaks,
    artwork: {
      acceptedTypes: rules.accepted_types ?? PLACEHOLDER_ACCEPTED_TYPES,
      maxFileSizeMb: Math.round(
        (rules.max_file_size_bytes ?? PLACEHOLDER_MAX_BYTES) / (1024 * 1024),
      ),
      minResolutionDpi: rules.min_resolution_dpi ?? null,
    },
    printArea: printAreas.front ?? PLACEHOLDER_PRINT_AREA,
    shippingFlat:
      shipping && typeof shipping.flat === "number" ? shipping.flat : null,
  };
}

export async function updateAdminSettings(
  input: AdminSettingsInput,
): Promise<void> {
  const admin = supabaseAdmin();

  for (const p of input.products) {
    const { error } = await admin
      .from("products")
      .update({ base_price: p.basePrice })
      .eq("id", p.id);
    if (error) throw error;
  }

  const { data: current, error: readErr } = await admin
    .from("settings")
    .select("data")
    .eq("id", 1)
    .single();
  if (readErr) throw readErr;

  const merged = {
    ...((current?.data ?? {}) as Data),
    bulk_price_breaks: input.bulkPriceBreaks.map((b) => ({
      min_qty: b.minQty,
      unit_price: b.unitPrice,
    })),
    artwork_rules: {
      accepted_types: input.artwork.acceptedTypes,
      max_file_size_bytes: Math.round(input.artwork.maxFileSizeMb * 1024 * 1024),
      min_resolution_dpi: input.artwork.minResolutionDpi,
    },
    print_areas: { front: input.printArea },
    shipping: input.shippingFlat === null ? null : { flat: input.shippingFlat },
  };

  const { error } = await admin.from("settings").update({ data: merged }).eq("id", 1);
  if (error) throw error;
}
