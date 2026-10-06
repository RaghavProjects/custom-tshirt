"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildStudioUrl } from "@/lib/studio-url";
import type { Product } from "@/lib/types";

function formatPrice(price: number | null): string {
  return price === null
    ? "Price: TBD — owner"
    : `₹${price.toLocaleString("en-IN")}`;
}

export default function ProductPicker({ products }: { products: Product[] }) {
  const router = useRouter();
  const [productId, setProductId] = useState<string | null>(
    products[0]?.id ?? null,
  );
  const [color, setColor] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);

  const selected = products.find((p) => p.id === productId) ?? null;
  const canStart = Boolean(selected && color && size);

  function chooseProduct(id: string) {
    setProductId(id);
    setColor(null);
    setSize(null);
  }

  if (products.length === 0) {
    return (
      <p className="text-muted">
        No products are available yet. Add blanks in the admin before selling.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="products-heading" className="flex flex-col gap-4">
        <h2 id="products-heading" className="font-display text-2xl">
          1. Pick a blank
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {products.map((product) => {
            const isActive = product.id === productId;
            return (
              <button
                key={product.id}
                type="button"
                data-testid={`product-${product.id}`}
                aria-pressed={isActive}
                onClick={() => chooseProduct(product.id)}
                className={`rounded-xl border p-5 text-left transition-colors ${
                  isActive
                    ? "border-accent bg-white"
                    : "border-line bg-white/60 hover:border-muted"
                }`}
              >
                <span className="block font-medium">{product.name}</span>
                <span className="mt-1 block text-sm text-muted">
                  {formatPrice(product.basePrice)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selected && (
        <>
          <section aria-labelledby="color-heading" className="flex flex-col gap-4">
            <h2 id="color-heading" className="font-display text-2xl">
              2. Choose a colour
            </h2>
            <div className="flex flex-wrap gap-3">
              {selected.colors.map((c) => {
                const isActive = c.hex === color;
                return (
                  <button
                    key={c.hex}
                    type="button"
                    data-testid={`color-${c.hex}`}
                    aria-label={c.name}
                    aria-pressed={isActive}
                    onClick={() => setColor(c.hex)}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 ${
                      isActive ? "border-accent" : "border-line"
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full border border-line"
                      style={{ backgroundColor: c.hex }}
                    />
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="size-heading" className="flex flex-col gap-4">
            <h2 id="size-heading" className="font-display text-2xl">
              3. Choose a size
            </h2>
            <div className="flex flex-wrap gap-2">
              {selected.sizes.map((s) => {
                const isActive = s === size;
                return (
                  <button
                    key={s}
                    type="button"
                    data-testid={`size-${s}`}
                    aria-pressed={isActive}
                    onClick={() => setSize(s)}
                    className={`h-11 min-w-11 rounded-lg border px-4 ${
                      isActive
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-white"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              data-testid="start-designing"
              disabled={!canStart}
              onClick={() => {
                if (selected && color && size) {
                  router.push(buildStudioUrl(selected.id, color, size));
                }
              }}
              className="h-12 rounded-full bg-accent px-8 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start designing
            </button>
            {!canStart && (
              <p className="text-sm text-muted">
                Choose a colour and a size to continue.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
