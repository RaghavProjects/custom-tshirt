export type NotifyResult = {
  sent: boolean;
  skippedReason?: string;
  error?: string;
};

/**
 * Email ops when an order is paid. If Resend is not configured this reports
 * "skipped" honestly rather than pretending an email went out.
 */
export async function notifyOpsPaidOrder(order: {
  id: string;
  total_price: number | string;
  print_method: string;
  quantity: number;
}): Promise<NotifyResult> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFY_EMAIL;

  if (!key || !to) {
    return { sent: false, skippedReason: "RESEND_API_KEY / ORDER_NOTIFY_EMAIL not set" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: "Sweet Ginger Studio <studio@sweetginger.example>",
        to: [to],
        subject: `New paid order ${order.id}`,
        text: [
          `Order ${order.id} is paid.`,
          `Quantity: ${order.quantity}`,
          `Print method: ${order.print_method}`,
          `Total: ₹${order.total_price}`,
        ].join("\n"),
      }),
    });

    if (!res.ok) {
      return { sent: false, error: `Resend responded ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}
