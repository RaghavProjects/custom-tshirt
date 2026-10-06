import { NextResponse, type NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { canTransition, nextStates, type OrderState } from "@/lib/order-status";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    to?: string;
  } | null;
  const to = body?.to as OrderState | undefined;

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from("orders")
    .select("status")
    .eq("id", id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }

  const from = order.status as OrderState;
  if (!to || !canTransition(from, to)) {
    return NextResponse.json(
      {
        error: `Cannot move from "${from}" to "${to ?? "?"}".`,
        allowed: nextStates(from),
      },
      { status: 409 },
    );
  }

  const { error } = await admin.from("orders").update({ status: to }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("order_status_events").insert({
    order_id: id,
    from_state: from,
    to_state: to,
    actor: user.email,
  });

  return NextResponse.json({ ok: true, status: to });
}
