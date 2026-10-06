import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function list(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ConfirmationPage({
  searchParams,
}: PageProps<"/confirmation">) {
  const sp = await searchParams;
  const raw = list(sp.orders) ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  const { data } = ids.length
    ? await supabaseAdmin()
        .from("orders")
        .select("id,total_price,payment_status,status,quantity,print_method")
        .in("id", ids)
    : { data: [] };
  const orders = data ?? [];
  const allPaid = orders.length > 0 && orders.every((o) => o.payment_status === "paid");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <h1 className="font-display text-3xl" data-testid="confirmation-heading">
        {allPaid ? "Order confirmed" : "Order received"}
      </h1>
      <p className="mt-2 text-muted">
        {allPaid
          ? "Payment is confirmed and your order is with the print team."
          : "We have your order. Payment is still pending."}
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {orders.map((o) => (
          <li
            key={o.id}
            data-testid={`order-${o.id}`}
            className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm"
          >
            <span>
              Order {o.id.slice(0, 8)} · qty {o.quantity} ·{" "}
              <span className="capitalize">{o.print_method}</span>
            </span>
            <span className={o.payment_status === "paid" ? "text-accent" : ""}>
              {o.payment_status} · ₹{o.total_price}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-full bg-accent px-8 font-medium text-white"
      >
        Back to the studio
      </Link>
    </main>
  );
}
