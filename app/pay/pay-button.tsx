"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PayButton({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/sandbox/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderIds }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? "Payment failed.");
        setBusy(false);
        return;
      }
      router.push(`/confirmation?orders=${orderIds.join(",")}`);
    } catch {
      setError("Payment failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        data-testid="pay-now"
        onClick={pay}
        disabled={busy}
        className="h-12 w-fit rounded-full bg-accent px-8 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Paying…" : "Pay now (sandbox)"}
      </button>
      {error && (
        <p data-testid="pay-error" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
