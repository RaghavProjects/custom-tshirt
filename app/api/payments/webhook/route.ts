import { NextResponse, type NextRequest } from "next/server";
import { notifyOpsPaidOrder } from "@/lib/notify";
import { getPaymentProvider } from "@/lib/payments/provider";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  const provider = getPaymentProvider();
  const event = provider.verifyWebhook(raw, headers);
  if (!event.ok) {
    // Unverified events change nothing.
    return NextResponse.json(
      { error: `Webhook rejected: ${event.reason}` },
      { status: 400 },
    );
  }

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id,total_price,print_method,quantity,payment_status,payment_event_id",
    )
    .eq("id", event.orderId)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  if (event.status === "failed") {
    await admin
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", order.id);
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // Idempotency: the same event must not act twice.
  if (order.payment_event_id === event.eventId) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: true, already_paid: true });
  }

  const { error } = await admin
    .from("orders")
    .update({
      payment_status: "paid",
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_event_id: event.eventId,
    })
    .eq("id", order.id);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("order_status_events").insert({
    order_id: order.id,
    from_state: "pending_payment",
    to_state: "paid",
    actor: provider.name,
  });

  const email = await notifyOpsPaidOrder({
    id: order.id,
    total_price: order.total_price,
    print_method: order.print_method,
    quantity: order.quantity,
  });

  return NextResponse.json({ ok: true, status: "paid", email });
}
