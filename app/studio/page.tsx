import Link from "next/link";
import { getProducts } from "@/lib/catalog";
import { getStudioSettings } from "@/lib/settings";
import Studio from "./studio";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudioPage({
  searchParams,
}: PageProps<"/studio">) {
  const params = await searchParams;
  const productId = first(params.product);
  const colorHex = first(params.color);
  const size = first(params.size);

  const [products, settings] = await Promise.all([
    getProducts(),
    getStudioSettings(),
  ]);
  const product = products.find((p) => p.id === productId) ?? null;
  const color = product?.colors.find((c) => c.hex === colorHex) ?? null;

  if (!product || !color || !size || !product.sizes.includes(size)) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
        <h1 className="font-display text-3xl">Start from a blank</h1>
        <p className="mt-4 text-muted">
          That selection is incomplete. Choose a product, colour and size first.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-8 font-medium text-white"
        >
          Back to the picker
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
        Studio
      </p>
      <h1 className="mt-3 font-display text-3xl" data-testid="studio-heading">
        {product.name}
      </h1>
      <p className="mt-2 text-muted">
        {color.name} · size <span data-testid="studio-size">{size}</span>
      </p>

      <div className="mt-10">
        <Studio
          productName={product.name}
          size={size}
          shirtColor={color.hex}
          printArea={settings.printArea}
          printAreaIsPlaceholder={settings.printAreaIsPlaceholder}
          artworkRules={settings.artworkRules}
        />
      </div>
    </main>
  );
}
