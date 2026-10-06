"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addToCart, type PrintMethod } from "@/lib/cart";
import {
  deserializeDesign,
  makeImageElement,
  makeTextElement,
  serializeDesign,
  TEXT_COLORS,
  TEXT_FONTS,
  type DesignElement,
  type DesignState,
  type PrintArea,
  type Side,
} from "@/lib/design";
import type { ColorOption } from "@/lib/types";
import type { ArtworkRules } from "@/lib/settings";

const Canvas = dynamic(() => import("./canvas"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[600px] place-items-center rounded-2xl border border-line bg-white text-muted">
      Loading canvas…
    </div>
  ),
});

const STAGE_W = 520;
const STAGE_H = 600;
const PRINT_METHODS: PrintMethod[] = ["dtf", "embroidery", "vinyl"];

type StudioProps = {
  productId: string;
  productName: string;
  colors: ColorOption[];
  sizes: string[];
  initialColor: string;
  initialSize: string;
  printArea: PrintArea;
  printAreaIsPlaceholder: boolean;
  artworkRules: ArtworkRules;
};

export default function Studio({
  productId,
  productName,
  colors,
  sizes,
  initialColor,
  initialSize,
  printArea,
  printAreaIsPlaceholder,
  artworkRules,
}: StudioProps) {
  const [side, setSide] = useState<Side>("front");
  const [colorHex, setColorHex] = useState(initialColor);
  const [size, setSize] = useState(initialSize);
  const [design, setDesign] = useState<DesignState>({ front: [], back: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const [printMethod, setPrintMethod] = useState<PrintMethod>("dtf");
  const [qty, setQty] = useState(1);
  const [bulk, setBulk] = useState(false);
  const [bulkQty, setBulkQty] = useState<Record<string, number>>({});
  const [added, setAdded] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(STAGE_W);

  const storageKey = `sg-design-${productId}`;

  // Restore a saved design once on mount, then persist on every change.
  useEffect(() => {
    // Reading an external store (localStorage) on mount is intentional here;
    // the design is client-only state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesign(deserializeDesign(localStorage.getItem(storageKey)));
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, serializeDesign(design));
  }, [design, ready, storageKey]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el);
    setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(1, avail / STAGE_W);
  const elements = design[side];
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const color = colors.find((c) => c.hex === colorHex) ?? null;

  const sizeBreakdown: Record<string, number> = bulk
    ? Object.fromEntries(
        Object.entries(bulkQty).filter(([, n]) => n > 0),
      )
    : { [size]: qty };
  const quantity = Object.values(sizeBreakdown).reduce((a, b) => a + b, 0);
  const totalElements = design.front.length + design.back.length;
  const canAdd = totalElements >= 1 && quantity >= 1;

  function updateElement(id: string, attrs: Partial<DesignElement>) {
    setDesign((prev) => ({
      ...prev,
      [side]: prev[side].map((e) =>
        e.id === id ? ({ ...e, ...attrs } as DesignElement) : e,
      ),
    }));
  }

  function addText() {
    const el = makeTextElement({
      x: printArea.x + printArea.width * 0.2,
      y: printArea.y + printArea.height * 0.4,
    });
    setDesign((prev) => ({ ...prev, [side]: [...prev[side], el] }));
    setSelectedId(el.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    setDesign((prev) => ({
      ...prev,
      [side]: prev[side].filter((e) => e.id !== selectedId),
    }));
    setSelectedId(null);
  }

  function onAddToCart() {
    if (!canAdd) return;
    addToCart({
      productId,
      productName,
      colorHex,
      colorName: color?.name ?? colorHex,
      printMethod,
      quantity,
      sizeBreakdown,
      design,
    });
    setAdded(true);
  }

  async function onUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Upload failed.");
        return;
      }

      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = json.url;
      await img.decode().catch(() => undefined);

      const natW = img.naturalWidth || 120;
      const natH = img.naturalHeight || 120;
      const maxW = printArea.width * 0.5;
      const maxH = printArea.height * 0.5;
      const ratio = Math.min(maxW / natW, maxH / natH, 1);

      const el = makeImageElement({
        url: json.url,
        x: printArea.x + printArea.width * 0.25,
        y: printArea.y + printArea.height * 0.25,
        width: Math.round(natW * ratio),
        height: Math.round(natH * ratio),
      });
      setDesign((prev) => ({ ...prev, [side]: [...prev[side], el] }));
      setSelectedId(el.id);
    } catch {
      setError("Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">
            Colour
          </span>
          {colors.map((c) => (
            <button
              key={c.hex}
              type="button"
              data-testid={`studio-color-${c.hex}`}
              aria-label={c.name}
              aria-pressed={c.hex === colorHex}
              onClick={() => setColorHex(c.hex)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                c.hex === colorHex ? "border-accent" : "border-line"
              }`}
            >
              <span
                className="h-6 w-6 rounded-full border border-line"
                style={{ backgroundColor: c.hex }}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted">Size</span>
          {sizes.map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`studio-size-${s}`}
              aria-pressed={s === size}
              onClick={() => setSize(s)}
              className={`h-9 min-w-9 rounded-lg border px-3 text-sm ${
                s === size ? "border-accent bg-accent text-white" : "border-line"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-full border border-line bg-white p-1">
          {(["front", "back"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              data-testid={`side-${s}`}
              aria-pressed={side === s}
              onClick={() => {
                setSide(s);
                setSelectedId(null);
              }}
              className={`h-9 rounded-full px-5 text-sm capitalize ${
                side === s ? "bg-accent text-white" : "text-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          type="button"
          data-testid="add-text"
          onClick={addText}
          className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-white"
        >
          Add text
        </button>

        <label
          aria-busy={busy}
          className={`inline-flex h-11 cursor-pointer items-center rounded-full border border-line bg-white px-6 text-sm font-medium ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {busy ? "Uploading…" : "Upload artwork"}
          <input
            type="file"
            accept={artworkRules.acceptedTypes.join(",")}
            data-testid="upload-input"
            onChange={onUpload}
            className="sr-only"
          />
        </label>

        {selectedId && (
          <button
            type="button"
            data-testid="remove-element"
            onClick={removeSelected}
            className="h-11 rounded-full border border-line bg-white px-6 text-sm text-muted"
          >
            Remove
          </button>
        )}
      </div>

      {selected?.kind === "text" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-4">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Text
            <input
              data-testid="text-content"
              value={selected.content}
              onChange={(e) =>
                updateElement(selected.id, { content: e.target.value })
              }
              className="h-10 w-56 rounded-lg border border-line px-3 text-sm text-fg"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Font
            <select
              data-testid="text-font"
              value={selected.fontFamily}
              onChange={(e) =>
                updateElement(selected.id, { fontFamily: e.target.value })
              }
              className="h-10 rounded-lg border border-line px-3 text-sm text-fg"
            >
              {TEXT_FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Size
            <input
              type="number"
              min={10}
              max={120}
              data-testid="text-size"
              value={selected.fontSize}
              onChange={(e) =>
                updateElement(selected.id, {
                  fontSize: Number(e.target.value) || 10,
                })
              }
              className="h-10 w-20 rounded-lg border border-line px-3 text-sm text-fg"
            />
          </label>
          <div className="flex flex-col gap-1 text-xs text-muted">
            Colour
            <div className="flex gap-2">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Text colour ${c}`}
                  aria-pressed={selected.fill === c}
                  onClick={() => updateElement(selected.id, { fill: c })}
                  className={`h-8 w-8 rounded-full border-2 ${
                    selected.fill === c ? "border-accent" : "border-line"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p
          data-testid="studio-error"
          className="rounded-lg bg-white px-4 py-3 text-sm text-accent"
        >
          {error}
        </p>
      )}

      <div ref={wrapRef} className="w-full">
        <div
          style={{ width: STAGE_W * scale, height: STAGE_H * scale }}
          className="mx-auto"
        >
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: STAGE_W,
              height: STAGE_H,
            }}
          >
            <Canvas
              width={STAGE_W}
              height={STAGE_H}
              shirtColor={colorHex}
              printArea={printArea}
              elements={elements}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={updateElement}
            />
          </div>
        </div>
      </div>

      {printAreaIsPlaceholder && (
        <p className="text-xs text-muted">
          Print area and artwork limits are placeholders until Shankar supplies
          them.
        </p>
      )}

      <section className="flex flex-wrap items-end gap-6 rounded-2xl border border-line bg-white p-4">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Print method
          <select
            data-testid="print-method"
            value={printMethod}
            onChange={(e) => setPrintMethod(e.target.value as PrintMethod)}
            className="h-10 rounded-lg border border-line px-3 text-sm capitalize text-fg"
          >
            {PRINT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="bulk-toggle"
            checked={bulk}
            onChange={(e) => setBulk(e.target.checked)}
          />
          Bulk (quantity per size)
        </label>

        {!bulk ? (
          <label className="flex flex-col gap-1 text-xs text-muted">
            Quantity
            <input
              type="number"
              min={1}
              data-testid="quantity"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="h-10 w-20 rounded-lg border border-line px-3 text-sm text-fg"
            />
          </label>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            {sizes.map((s) => (
              <label key={s} className="flex flex-col gap-1 text-xs text-muted">
                {s}
                <input
                  type="number"
                  min={0}
                  data-testid={`bulk-${s}`}
                  value={bulkQty[s] ?? 0}
                  onChange={(e) =>
                    setBulkQty((prev) => ({
                      ...prev,
                      [s]: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                  className="h-10 w-16 rounded-lg border border-line px-3 text-sm text-fg"
                />
              </label>
            ))}
          </div>
        )}

        <span className="text-sm text-muted" data-testid="quantity-total">
          Total: {quantity}
        </span>

        <button
          type="button"
          data-testid="add-to-cart"
          onClick={onAddToCart}
          disabled={!canAdd}
          className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add to cart
        </button>

        {added && (
          <Link href="/cart" className="text-sm text-accent underline">
            View cart
          </Link>
        )}

        {totalElements === 0 && (
          <p className="text-sm text-muted">
            Add text or artwork before adding to cart.
          </p>
        )}
      </section>

      <section
        aria-label="Design elements"
        className="rounded-2xl border border-line bg-white p-4"
      >
        <h2 className="font-display text-lg">
          {side} · {productName} · {color?.name ?? colorHex} · size {size}
        </h2>
        {elements.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Nothing on the {side} yet. Add text or upload artwork.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {elements.map((el) => (
              <li key={el.id} data-testid={`element-${el.id}`}>
                {el.kind === "text" ? `Text: ${el.content}` : "Artwork"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <pre data-testid="design-json" className="sr-only">
        {JSON.stringify(design)}
      </pre>
    </div>
  );
}
