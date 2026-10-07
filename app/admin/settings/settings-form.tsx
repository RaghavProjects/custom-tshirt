"use client";

import { useState } from "react";
import type { AdminSettingsData } from "@/lib/admin-settings";

type Tier = { minQty: number; unitPrice: number };

export default function SettingsForm({
  initial,
}: {
  initial: AdminSettingsData;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      initial.products.map((p) => [
        p.id,
        p.basePrice === null ? "" : String(p.basePrice),
      ]),
    ),
  );
  const [tiers, setTiers] = useState<Tier[]>(initial.bulkPriceBreaks);
  const [acceptedTypes, setAcceptedTypes] = useState(
    initial.artwork.acceptedTypes.join(", "),
  );
  const [maxSizeMb, setMaxSizeMb] = useState(String(initial.artwork.maxFileSizeMb));
  const [minDpi, setMinDpi] = useState(
    initial.artwork.minResolutionDpi === null
      ? ""
      : String(initial.artwork.minResolutionDpi),
  );
  const [area, setArea] = useState(initial.printArea);
  const [shipping, setShipping] = useState(
    initial.shippingFlat === null ? "" : String(initial.shippingFlat),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function numOrNull(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setBusy(true);
    try {
      const payload = {
        products: initial.products.map((p) => ({
          id: p.id,
          basePrice: numOrNull(prices[p.id] ?? ""),
        })),
        bulkPriceBreaks: tiers,
        artwork: {
          acceptedTypes: acceptedTypes
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          maxFileSizeMb: Number(maxSizeMb),
          minResolutionDpi: minDpi.trim() === "" ? null : Number(minDpi),
        },
        printArea: area,
        shippingFlat: numOrNull(shipping),
      };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        fields?: { path: string; message: string }[];
      } | null;
      if (!res.ok) {
        const detail = body?.fields?.map((f) => `${f.path}: ${f.message}`).join("; ");
        setError([body?.error ?? "Could not save.", detail].filter(Boolean).join(" — "));
        return;
      }
      setNotice("Saved.");
    } catch {
      setError("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl">Prices</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {initial.products.map((p) => (
            <label key={p.id} className="flex flex-col gap-1 text-sm">
              <span className="text-muted">{p.name}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                data-testid={`price-${p.id}`}
                value={prices[p.id] ?? ""}
                onChange={(e) =>
                  setPrices((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
                className="h-11 rounded-lg border border-line px-3"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl">Bulk tiers</h2>
        <p className="mt-1 text-sm text-muted">
          Quantity threshold and unit price. The lowest matching tier is used.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {tiers.map((t, i) => (
            <li key={i} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Min qty</span>
                <input
                  type="number"
                  min={1}
                  data-testid={`tier-qty-${i}`}
                  value={t.minQty}
                  onChange={(e) =>
                    setTiers((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? { ...x, minQty: Math.max(1, Number(e.target.value) || 1) }
                          : x,
                      ),
                    )
                  }
                  className="h-11 w-28 rounded-lg border border-line px-3"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Unit price</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  data-testid={`tier-price-${i}`}
                  value={t.unitPrice}
                  onChange={(e) =>
                    setTiers((prev) =>
                      prev.map((x, j) =>
                        j === i
                          ? { ...x, unitPrice: Number(e.target.value) || 0 }
                          : x,
                      ),
                    )
                  }
                  className="h-11 w-32 rounded-lg border border-line px-3"
                />
              </label>
              <button
                type="button"
                onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
                className="h-11 rounded-full border border-line px-5 text-sm text-muted"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          data-testid="add-tier"
          onClick={() =>
            setTiers((prev) => [...prev, { minQty: 1, unitPrice: 0 }])
          }
          className="mt-4 h-10 rounded-full border border-line px-5 text-sm"
        >
          Add tier
        </button>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl">Artwork rules</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm sm:col-span-1">
            <span className="text-muted">Accepted types</span>
            <input
              data-testid="artwork-types"
              value={acceptedTypes}
              onChange={(e) => setAcceptedTypes(e.target.value)}
              className="h-11 rounded-lg border border-line px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Max size (MB)</span>
            <input
              type="number"
              min={1}
              data-testid="artwork-max-mb"
              value={maxSizeMb}
              onChange={(e) => setMaxSizeMb(e.target.value)}
              className="h-11 rounded-lg border border-line px-3"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Min DPI (optional)</span>
            <input
              type="number"
              min={1}
              data-testid="artwork-min-dpi"
              value={minDpi}
              onChange={(e) => setMinDpi(e.target.value)}
              className="h-11 rounded-lg border border-line px-3"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl">Print area (front)</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["x", "y", "width", "height"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              <span className="text-muted capitalize">{k}</span>
              <input
                type="number"
                min={0}
                data-testid={`area-${k}`}
                value={area[k]}
                onChange={(e) =>
                  setArea((prev) => ({ ...prev, [k]: Number(e.target.value) || 0 }))
                }
                className="h-11 rounded-lg border border-line px-3"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl">Shipping</h2>
        <label className="mt-4 flex flex-col gap-1 text-sm sm:w-48">
          <span className="text-muted">Flat fee (optional)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            data-testid="shipping-flat"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
            className="h-11 rounded-lg border border-line px-3"
          />
        </label>
      </section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          data-testid="save-settings"
          disabled={busy}
          className="h-12 rounded-full bg-accent px-8 font-medium text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
        {notice && (
          <span data-testid="settings-notice" className="text-sm text-accent">
            {notice}
          </span>
        )}
        {error && (
          <span data-testid="settings-error" className="text-sm text-accent">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
