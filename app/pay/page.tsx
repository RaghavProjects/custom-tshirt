import { supabaseAdmin } from "@/lib/supabase/server";
import PayButton from "./pay-button";

export const dynamic = "force-dynamic";

function list(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PayPage({ searchParams }: PageProps<"/pay">) {
  const sp = await searchParams;
  const raw = list(sp.orders) ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
        <h1 className="font-display text-3xl">Nothing to pay</h1>
        <p className="mt-4 text-muted">No orders were found for this session.</p>
      </main>
    );
  }

  const { data } = await supabaseAdmin()
    .from("orders")
    .select("id,total_price,payment_status,quantity,print_method")
    .in("id", ids);
  const orders = data ?? [];
  const grand = orders.reduce((sum, o) => sum + Number(o.total_price), 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-24">
      <h1 className="font-display text-3xl">Payment</h1>
      <p className="mt-2 text-sm text-muted">
        Sandbox payment — no real money is taken. A live provider is chosen later.
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {orders.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between rounded-xl border border-line bg-white p-4 text-sm"
          >
            <span>
              Order {o.id.slice(0, 8)} · qty {o.quantity} ·{" "}
              <span className="capitalize">{o.print_method}</span>
            </span>
            <span>₹{o.total_price}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-lg" data-testid="grand-total">
        Total: ₹{grand}
      </p>

      <div className="mt-8">
        <PayButton orderIds={orders.map((o) => o.id)} />
      </div>
    </main>
  );
}
