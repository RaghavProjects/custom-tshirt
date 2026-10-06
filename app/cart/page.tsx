"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  cartCount,
  clearCart,
  readCart,
  removeFromCart,
  type CartItem,
} from "@/lib/cart";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart());
  }, []);

  if (items.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="font-display text-3xl">Your cart is empty</h1>
        <p className="mt-4 text-muted">
          Design a shirt and add it to your cart to see it here.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-8 font-medium text-white"
        >
          Start designing
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <h1 className="font-display text-3xl">Your cart</h1>
      <p className="mt-2 text-muted" data-testid="cart-count">
        {cartCount(items)} item(s)
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {items.map((item) => (
          <li
            key={item.id}
            data-testid="cart-item"
            className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5"
          >
            <div>
              <p className="font-medium">
                {item.productName} · {item.colorName} ·{" "}
                <span className="capitalize">{item.printMethod}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Sizes:{" "}
                {Object.entries(item.sizeBreakdown)
                  .map(([s, n]) => `${s}×${n}`)
                  .join(", ")}{" "}
                · qty {item.quantity}
              </p>
            </div>
            <button
              type="button"
              data-testid={`remove-${item.id}`}
              onClick={() => setItems(removeFromCart(item.id))}
              className="text-sm text-muted underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-muted">
        Total is confirmed at checkout from the owner&apos;s prices.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/checkout"
          data-testid="to-checkout"
          className="inline-flex h-12 items-center rounded-full bg-accent px-8 font-medium text-white"
        >
          Checkout
        </Link>
        <button
          type="button"
          onClick={() => setItems(clearCart() ?? [])}
          className="text-sm text-muted underline"
        >
          Clear cart
        </button>
      </div>
    </main>
  );
}
