export type ColorOption = {
  name: string;
  hex: string;
};

export type Product = {
  id: string;
  name: string;
  category: "tee" | "hoodie" | "cap";
  basePrice: number | null;
  colors: ColorOption[];
  sizes: string[];
};
