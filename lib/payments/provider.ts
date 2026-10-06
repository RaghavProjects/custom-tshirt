export type IntentResult = {
  reference: string;
  /** Where the browser is sent to pay. Never trusted as proof of payment. */
  redirectUrl: string;
};

export type WebhookResult =
  | {
      ok: true;
      eventId: string;
      orderId: string;
      status: "paid" | "failed";
    }
  | { ok: false; reason: string };

export interface PaymentProvider {
  name: string;
  createIntent(args: {
    orderId: string;
    amount: number;
    currency: string;
  }): Promise<IntentResult>;
  /** Verify a raw webhook body against its signature. Returns a parsed event. */
  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): WebhookResult;
}

import { sandboxProvider } from "./sandbox";

/**
 * The active provider. v1 uses the sandbox adapter; a Razorpay or Stripe
 * adapter drops in here without touching checkout or the webhook handler.
 */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER;
  if (name === "razorpay" || name === "stripe") {
    throw new Error(
      `Payment provider "${name}" is selected but no adapter is installed yet.`,
    );
  }
  return sandboxProvider;
}
