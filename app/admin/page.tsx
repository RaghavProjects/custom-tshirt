import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const { data } = await supabaseAdmin()
    .from("orders")
    .select(
      "id,quantity,print_method,total_price,status,payment_status,customer,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = data ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Orders</h1>
        <span className="flex items-center gap-4 text-sm text-muted">
          <Link href="/admin/settings" data-testid="admin-settings-link" className="underline">
            Settings
          </Link>
          {user.email}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="mt-8 text-muted" data-testid="admin-empty">
          No orders yet.
        </p>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {orders.map((o) => {
            const customer = o.customer as { name?: string } | null;
            return (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  data-testid="admin-order-row"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 text-sm hover:border-muted"
                >
                  <span>
                    {o.id.slice(0, 8)} · {customer?.name ?? "—"} · qty{" "}
                    {o.quantity} ·{" "}
                    <span className="capitalize">{o.print_method}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="rounded-full border border-line px-3 py-0.5 text-xs">
                      {o.status}
                    </span>
                    <span
                      className={
                        o.payment_status === "paid" ? "text-accent" : "text-muted"
                      }
                    >
                      {o.payment_status}
                    </span>
                    <span>₹{o.total_price}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
