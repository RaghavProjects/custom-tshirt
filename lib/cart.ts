import type { DesignState } from "./design";

/** One source of truth for print methods (UI, schema and DB enum mirror this). */
export const PRINT_METHODS = ["dtf", "embroidery", "vinyl"] as const;

export type PrintMethod = (typeof PRINT_METHODS)[number];

export type CartItem = {
  id: string;
  productId: string;
  productName: string;
  colorHex: string;
  colorName: string;
  printMethod: PrintMethod;
  quantity: number;
  sizeBreakdown: Record<string, number>;
  design: DesignState;
};

const KEY = "sg-cart";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addToCart(item: Omit<CartItem, "id">): CartItem[] {
  const next = [...readCart(), { ...item, id: crypto.randomUUID() }];
  writeCart(next);
  return next;
}

export function removeFromCart(id: string): CartItem[] {
  const next = readCart().filter((i) => i.id !== id);
  writeCart(next);
  return next;
}

export function clearCart(): void {
  writeCart([]);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}
