import { supabaseAdmin } from "@/lib/supabase/server";
import type { Product } from "@/lib/types";

type ProductRow = {
  id: string;
  name: string;
  category: Product["category"];
  base_price: number | null;
  product_colors: { name: string; hex: string }[] | null;
  product_sizes: { label: string; sort_order: number }[] | null;
};

const CATEGORY_ORDER: Record<Product["category"], number> = {
  tee: 0,
  hoodie: 1,
  cap: 2,
};

/** Server-only: load the active catalogue with its colours and sizes. */
export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabaseAdmin()
    .from("products")
    .select(
      "id,name,category,base_price, product_colors(name,hex), product_sizes(label,sort_order)",
    )
    .eq("active", true);

  if (error) {
    throw new Error(`Failed to load products: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as ProductRow[];

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      basePrice: row.base_price,
      colors: (row.product_colors ?? []).map((c) => ({ name: c.name, hex: c.hex })),
      sizes: (row.product_sizes ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => s.label),
    }))
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
        a.name.localeCompare(b.name),
    );
}
