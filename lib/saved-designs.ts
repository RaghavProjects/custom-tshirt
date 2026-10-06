import type { DesignState } from "./design";
import type { PrintMethod } from "./cart";

export type SavedDesign = {
  id: string;
  name: string;
  savedAt: string;
  productId: string;
  productName: string;
  colorHex: string;
  colorName: string;
  printMethod: PrintMethod;
  quantity: number;
  sizeBreakdown: Record<string, number>;
  design: DesignState;
};

const KEY = "sg-saved-designs";
const MAX = 20;

export function readSaved(): SavedDesign[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SavedDesign[]) : [];
  } catch {
    return [];
  }
}

function write(items: SavedDesign[]): SavedDesign[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(items));
  }
  return items;
}

export function saveDesign(
  entry: Omit<SavedDesign, "id" | "savedAt">,
): SavedDesign[] {
  const record: SavedDesign = {
    ...entry,
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
  };
  const next = [record, ...readSaved()].slice(0, MAX);
  return write(next);
}

export function deleteSaved(id: string): SavedDesign[] {
  return write(readSaved().filter((s) => s.id !== id));
}

export function savedForProduct(productId: string): SavedDesign[] {
  return readSaved().filter((s) => s.productId === productId);
}
