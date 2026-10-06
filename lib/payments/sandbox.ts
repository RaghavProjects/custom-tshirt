import crypto from "node:crypto";
import type { PaymentProvider, WebhookResult } from "./provider";

// Sandbox only. A real provider supplies its own signing secret via env; this
// fallback exists so the sandbox flow is reproducible in development.
const SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "sandbox-dev-secret";

export function signSandbox(rawBody: string): string {
  return crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
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
    const provided = headers["x-sandbox-signature"];
    const expected = signSandbox(rawBody);

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
