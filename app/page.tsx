import { getProducts } from "@/lib/catalog";
import ProductPicker from "./product-picker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getProducts();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <header className="flex flex-col gap-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Sweet Ginger Fashions
        </p>
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          Design your own T-shirt
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">
          Pick a blank, add your design, and see it on the real shirt before you
          order. One shirt or a bulk run — both start here.
        </p>
      </header>

      <div className="mt-16">
        <ProductPicker products={products} />
      </div>
    </main>
  );
}
