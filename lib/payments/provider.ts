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

/** Sandbox payments are for development unless explicitly allowed (e.g. a
 * staging environment that has no real provider). */
export function sandboxPaymentsAllowed(): boolean {
  return (
    process.env.ALLOW_SANDBOX_PAYMENTS === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

/**
 * The active provider. Fails closed in production: an unset or sandbox provider
 * is refused unless sandbox payments are explicitly allowed, so a live
 * deployment cannot silently take (or fake) payments.
 */
export function getPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER;

  if (name === "razorpay" || name === "stripe") {
    throw new Error(
      `Payment provider "${name}" is selected but no adapter is installed yet.`,
    );
  }

  if (!name || name === "sandbox") {
    if (!sandboxPaymentsAllowed()) {
      throw new Error(
        "Payments are not configured for production. Set PAYMENT_PROVIDER to a live provider.",
      );
    }
    return sandboxProvider;
  }

  throw new Error(`Unknown payment provider "${name}".`);
}
