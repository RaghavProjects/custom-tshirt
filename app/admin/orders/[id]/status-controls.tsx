"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderState } from "@/lib/order-status";

export default function StatusControls({
  orderId,
  current,
  allowed,
}: {
  orderId: string;
  current: OrderState;
  allowed: OrderState[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move(to: OrderState) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(body?.error ?? "Could not update the status.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not update the status.");
    } finally {
      setBusy(false);
    }
  }

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-muted" data-testid="status-terminal">
        {current === "pending_payment"
          ? "This order is not paid yet, so it cannot go into production."
          : "No further steps — this order is complete."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {allowed.map((to) => (
          <button
            key={to}
            type="button"
            data-testid={`advance-${to}`}
            disabled={busy}
            onClick={() => move(to)}
            className="h-11 rounded-full bg-accent px-6 text-sm font-medium capitalize text-white disabled:opacity-40"
          >
            Mark {to.replace("_", " ")}
          </button>
        ))}
      </div>
      {error && (
        <p data-testid="status-error" className="text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
