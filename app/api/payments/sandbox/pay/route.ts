import { NextResponse, type NextRequest } from "next/server";
import { signSandbox } from "@/lib/payments/sandbox";

/**
 * Sandbox "gateway": stands in for a real provider. It emits a signed webhook
 * to the app, exactly as a real provider would, so the webhook path (signature
 * check, idempotency, paid-only-on-confirmation) is what actually runs.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    orderIds?: unknown;
  } | null;

  const orderIds = Array.isArray(body?.orderIds)
    ? body.orderIds.filter((v): v is string => typeof v === "string")
    : [];

  if (orderIds.length === 0) {
    return NextResponse.json(
      { error: "orderIds must be a non-empty array" },
      { status: 400 },
    );
  }

  const origin = new URL(request.url).origin;
  const results = [];

  for (const orderId of orderIds) {
    const payload = JSON.stringify({
      eventId: crypto.randomUUID(),
      orderId,
      status: "paid",
    });
    const res = await fetch(`${origin}/api/payments/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sandbox-signature": signSandbox(payload),
      },
      body: payload,
    });
    results.push({
      orderId,
      status: res.status,
      body: await res.json().catch(() => null),
    });
  }

  return NextResponse.json({ ok: true, results });
}
