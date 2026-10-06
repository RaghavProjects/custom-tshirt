import { NextResponse, type NextRequest } from "next/server";
import { checkoutSchema, issuesOf } from "@/lib/orders";
import { createOrder } from "@/lib/orders-service";
import { supabaseAdmin } from "@/lib/supabase/server";

async function rollback(orderIds: string[]) {
  if (orderIds.length === 0) return;
  const admin = supabaseAdmin();
  const { data } = await admin
    .from("orders")
    .select("design_id")
    .in("id", orderIds);
  const designIds = (data ?? [])
    .map((r) => r.design_id)
    .filter((v): v is string => typeof v === "string");
  await admin.from("orders").delete().in("id", orderIds);
  if (designIds.length) await admin.from("designs").delete().in("id", designIds);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid checkout", fields: issuesOf(parsed.error) },
      { status: 400 },
    );
  }

  const { items, customer, shipping } = parsed.data;
  const created: { orderId: string; unitPrice: number; total: number }[] = [];

  for (const item of items) {
    try {
      const result = await createOrder({ ...item, customer, shipping });
      if (!result.ok) {
        // A partial checkout is not acceptable: undo everything already created.
        await rollback(created.map((c) => c.orderId));
        return NextResponse.json(
          { error: result.error },
          { status: result.status },
        );
      }
      created.push({
        orderId: result.orderId,
        unitPrice: result.unitPrice,
        total: result.total,
      });
    } catch (err) {
      // A throw (e.g. misconfigured provider) must not leave orphan orders.
      await rollback(created.map((c) => c.orderId));
      return NextResponse.json(
        { error: `Checkout failed: ${(err as Error).message}` },
        { status: 500 },
      );
    }
  }

  const orderIds = created.map((c) => c.orderId);
  return NextResponse.json(
    {
      orderIds,
      totals: created,
      grandTotal: created.reduce((sum, c) => sum + c.total, 0),
      payUrl: `/pay?orders=${orderIds.join(",")}`,
    },
    { status: 201 },
  );
}
