import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import type { DesignElement } from "@/lib/design";
import { nextStates, type OrderState } from "@/lib/order-status";
import { supabaseAdmin } from "@/lib/supabase/server";
import DesignPreview from "../../design-preview";
import StatusControls from "./status-controls";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  quantity: number;
  size_breakdown: Record<string, number>;
  print_method: string;
  unit_price: number;
  total_price: number;
  status: OrderState;
  payment_status: string;
  customer: Record<string, string>;
  shipping: Record<string, string>;
  created_at: string;
  designs: {
    id: string;
    shirt_color: string;
    front_elements: DesignElement[];
    back_elements: DesignElement[];
    asset_urls: string[];
  } | null;
};

export default async function AdminOrderPage({
  params,
}: PageProps<"/admin/orders/[id]">) {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  const { id } = await params;
  const { data } = await supabaseAdmin()
    .from("orders")
    .select(
      "id,quantity,size_breakdown,print_method,unit_price,total_price,status,payment_status,customer,shipping,created_at, designs(id,shirt_color,front_elements,back_elements,asset_urls)",
    )
    .eq("id", id)
    .single();

  if (!data) notFound();
  const order = data as unknown as OrderRow;
  const design = order.designs;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12 sm:py-16">
      <Link href="/admin" className="text-sm text-muted underline">
        ← All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Order {order.id.slice(0, 8)}</h1>
        <span className="text-sm">
          <span className="rounded-full border border-line px-3 py-1">
            {order.status}
          </span>{" "}
          <span className={order.payment_status === "paid" ? "text-accent" : "text-muted"}>
            {order.payment_status}
          </span>
        </span>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <Field label="Customer" value={order.customer?.name ?? "—"} />
        <Field label="Phone" value={order.customer?.phone ?? "—"} />
        <Field label="Email" value={order.customer?.email ?? "—"} />
        <Field label="Ship to" value={order.shipping?.line1 ?? "—"} />
        <Field label="City" value={order.shipping?.city ?? "—"} />
        <Field label="Pincode" value={order.shipping?.pincode ?? "—"} />
        <Field label="Quantity" value={String(order.quantity)} />
        <Field
          label="Sizes"
          value={Object.entries(order.size_breakdown ?? {})
            .map(([s, n]) => `${s}×${n}`)
            .join(", ")}
        />
        <Field label="Print method" value={order.print_method} />
        <Field label="Unit / total" value={`₹${order.unit_price} / ₹${order.total_price}`} />
      </dl>

      {design && (
        <section className="mt-10">
          <h2 className="font-display text-xl">Design</h2>
          <div className="mt-4 flex flex-wrap gap-8">
            <DesignPreview
              shirtColor={design.shirt_color}
              elements={design.front_elements ?? []}
              label="Front"
            />
            <DesignPreview
              shirtColor={design.shirt_color}
              elements={design.back_elements ?? []}
              label="Back"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            {design.asset_urls?.map((url, i) => (
              <a
                key={url}
                href={url}
                download
                data-testid={`download-artwork-${i}`}
                className="underline"
              >
                Download artwork {i + 1}
              </a>
            ))}
            <a
              href={`/api/admin/orders/${order.id}/design`}
              data-testid="download-design-json"
              className="underline"
            >
              Download design file (JSON)
            </a>
            <a
              href={`/api/admin/orders/${order.id}/print?format=png`}
              data-testid="download-print-png"
              className="underline"
            >
              Print file — DTF/vinyl (PNG)
            </a>
            <a
              href={`/api/admin/orders/${order.id}/print?format=svg`}
              data-testid="download-print-svg"
              className="underline"
            >
              Embroidery (SVG)
            </a>
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl">Progress</h2>
        <div className="mt-4">
          <StatusControls
            orderId={order.id}
            current={order.status}
            allowed={nextStates(order.status)}
          />
        </div>
      </section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
