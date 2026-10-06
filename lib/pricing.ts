export type PriceBreak = {
  minQty: number;
  unitPrice: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Unit price for a quantity. Bulk tiers (owner-supplied) win; otherwise the
 * base price applies. Returns null when the owner has not set a price yet —
 * we never invent one.
 */
export function unitPriceFor(
  basePrice: number | null,
  quantity: number,
  breaks: PriceBreak[],
): number | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;

  const applicable = breaks
    .filter((b) => quantity >= b.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0];

  if (applicable) return applicable.unitPrice;
  return basePrice;
}

/** Total for a quantity at a unit price, or null if the price is unknown. */
export function orderTotal(
  unitPrice: number | null,
  quantity: number,
): number | null {
  if (unitPrice === null || quantity < 1) return null;
  return round2(unitPrice * quantity);
}
