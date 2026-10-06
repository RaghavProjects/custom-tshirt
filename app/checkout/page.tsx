"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearCart, readCart, type CartItem } from "@/lib/cart";
import { customerSchema, shippingSchema } from "@/lib/orders";

type Form = {
  name: string;
  phone: string;
  email: string;
  line1: string;
  city: string;
  pincode: string;
};

const EMPTY: Form = {
  name: "",
  phone: "",
  email: "",
  line1: "",
  city: "",
  pincode: "",
};

export default function CheckoutPage() {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(readCart());
  }, []);

  function set<K extends keyof Form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);

    const customer = customerSchema.safeParse({
      name: form.name,
      phone: form.phone,
      email: form.email,
    });
    const shipping = shippingSchema.safeParse({
      line1: form.line1,
      city: form.city,
      pincode: form.pincode,
    });

    const nextErrors: Record<string, string> = {};
    if (!customer.success) {
      for (const issue of customer.error.issues) {
        nextErrors[`customer.${issue.path.join(".")}`] = issue.message;
      }
    }
    if (!shipping.success) {
      for (const issue of shipping.error.issues) {
        nextErrors[`shipping.${issue.path.join(".")}`] = issue.message;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (items.length === 0) {
      setServerError("Your cart is empty.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customer: { name: form.name, phone: form.phone, email: form.email },
          shipping: {
            line1: form.line1,
            city: form.city,
            pincode: form.pincode,
          },
          items: items.map((i) => ({
            productId: i.productId,
            colorHex: i.colorHex,
            quantity: i.quantity,
            sizeBreakdown: i.sizeBreakdown,
            printMethod: i.printMethod,
            design: i.design,
          })),
        }),
      });
      const body = (await res.json()) as { payUrl?: string; error?: string };
      if (!res.ok || !body.payUrl) {
        setServerError(body.error ?? "Checkout failed.");
        return;
      }
      clearCart();
      router.push(body.payUrl);
    } catch {
      setServerError("Checkout failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <h1 className="font-display text-3xl">Checkout</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-muted">
          Your cart is empty. Add a design before checking out.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-col gap-8">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              value={form.name}
              onChange={(v) => set("name", v)}
              error={errors["customer.name"]}
              testid="field-name"
            />
            <Field
              label="Phone"
              value={form.phone}
              onChange={(v) => set("phone", v)}
              error={errors["customer.phone"]}
              testid="field-phone"
            />
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => set("email", v)}
              error={errors["customer.email"]}
              testid="field-email"
            />
            <Field
              label="Address"
              value={form.line1}
              onChange={(v) => set("line1", v)}
              error={errors["shipping.line1"]}
              testid="field-line1"
            />
            <Field
              label="City"
              value={form.city}
              onChange={(v) => set("city", v)}
              error={errors["shipping.city"]}
              testid="field-city"
            />
            <Field
              label="Pincode"
              value={form.pincode}
              onChange={(v) => set("pincode", v)}
              error={errors["shipping.pincode"]}
              testid="field-pincode"
            />
          </section>

          {serverError && (
            <p
              data-testid="checkout-error"
              className="rounded-lg bg-white px-4 py-3 text-sm text-accent"
            >
              {serverError}
            </p>
          )}

          <button
            type="submit"
            data-testid="place-order"
            disabled={busy}
            className="h-12 w-fit rounded-full bg-accent px-8 font-medium text-white disabled:opacity-40"
          >
            {busy ? "Placing…" : "Place order and pay"}
          </button>
        </form>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  testid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  testid: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      <input
        data-testid={testid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-line px-3"
      />
      {error && <span className="text-xs text-accent">{error}</span>}
    </label>
  );
}
