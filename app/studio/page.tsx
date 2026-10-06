import Link from "next/link";
import { getProducts } from "@/lib/catalog";

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

  const products = await getProducts();
  const product = products.find((p) => p.id === productId) ?? null;

  if (!product || !colorHex || !size) {
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

  const color = product.colors.find((c) => c.hex === colorHex);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-accent">
        Studio
      </p>
      <h1 className="mt-3 font-display text-3xl" data-testid="studio-heading">
        {product.name}
      </h1>

      <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 text-sm">
        <div>
          <dt className="text-muted">Colour</dt>
          <dd className="mt-1 flex items-center gap-2">
            <span
              className="inline-block h-5 w-5 rounded-full border border-line"
              style={{ backgroundColor: colorHex }}
            />
            {color?.name ?? colorHex}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Size</dt>
          <dd className="mt-1" data-testid="studio-size">
            {size}
          </dd>
        </div>
      </dl>

      <div className="mt-12 rounded-2xl border border-line bg-white p-10 text-center text-muted">
        The design canvas arrives in the next build step. Your selection is held
        in the URL, so it survives a refresh.
      </div>
    </main>
  );
}
