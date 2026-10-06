import crypto from "node:crypto";
import type { PaymentProvider, WebhookResult } from "./provider";

// Fail closed: the signing secret must be provided by the environment. A
// committed default would let anyone forge a "paid" webhook.
function getSecret(): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "PAYMENT_WEBHOOK_SECRET is not set; refusing to sign or verify payments.",
    );
  }
  return secret;
}

export function signSandbox(rawBody: string): string {
  return crypto.createHmac("sha256", getSecret()).update(rawBody).digest("hex");
}

export const sandboxProvider: PaymentProvider = {
  name: "sandbox",

  async createIntent({ orderId }) {
    return {
      reference: `sbx_${orderId}`,
      redirectUrl: `/pay?orders=${orderId}`,
    };
  },

  verifyWebhook(rawBody, headers): WebhookResult {
    let expected: string;
    try {
      expected = signSandbox(rawBody);
    } catch (err) {
      return { ok: false, reason: (err as Error).message };
    }

    const provided = headers["x-sandbox-signature"];
    const a = Buffer.from(provided ?? "", "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid signature" };
    }

    let parsed: { eventId?: string; orderId?: string; status?: string };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "invalid JSON" };
    }

    if (!parsed.eventId || !parsed.orderId) {
      return { ok: false, reason: "missing eventId or orderId" };
    }
    if (parsed.status !== "paid" && parsed.status !== "failed") {
      return { ok: false, reason: "unknown status" };
    }

    return {
      ok: true,
      eventId: parsed.eventId,
      orderId: parsed.orderId,
      status: parsed.status,
    };
  },
};
