import { NextResponse, type NextRequest } from "next/server";
import { issuesOf, orderSchema } from "@/lib/orders";
import { createOrder } from "@/lib/orders-service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    // Rejected: nothing is written (AGENTS.md §3).
    return NextResponse.json(
      { error: "Invalid order", fields: issuesOf(parsed.error) },
      { status: 400 },
    );
  }

  const result = await createOrder(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return NextResponse.json(
    {
      orderId: result.orderId,
      unitPrice: result.unitPrice,
      total: result.total,
      payUrl: result.payUrl,
      status: "pending_payment",
    },
    { status: 201 },
  );
}
