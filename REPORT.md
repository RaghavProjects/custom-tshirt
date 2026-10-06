# REPORT — Sweet Ginger Custom T-Shirt Design Studio

Built against `PRD.md`, `TECH-STACK.md`, `IMPLEMENTATION-PLAN.md`. Every claim
below was seen in real command output; unverified items are marked.

## Status per part

**Phase 0 — scaffold:** DONE
`pnpm create next-app …` → Next 16.3.8, React 19.2.8, TS 5.9.3, Tailwind 4.3.3.
`pnpm test` 1 passed; `pnpm e2e` 2 passed; lint clean.

**Phase 1 — data + owner slots:** DONE
`0001_init.sql` applied in Supabase ("Success. No rows returned"). REST probes:
order without `design_id` → `400 23502`; design with no element → `400 23514`;
paid without confirmation → `400 23514`; duplicate `payment_event_id` → `409 23505`.
3 tees, 15 sizes, 9 colours seeded; settings row all-null.

**Phase 2 — product picker:** DONE
`pnpm test` 3 passed; `pnpm e2e` 6 passed (1440+375); screens viewed.

**Phase 3 — design canvas:** DONE
Konva text + image upload (Supabase Storage), move/scale/rotate, front/back,
print-area clamp. `pnpm test` 14; `pnpm e2e` 14; lint/tsc clean.

**Phase 4 — live preview + persistence:** DONE
Multiply blend on light shirts + fabric shading; colour/size switching keeps the
design; structured JSON + localStorage persistence. `pnpm test` 19; `pnpm e2e` 18.

**Phase 5 — pricing + edge validation:** DONE
`scripts/phase5-order-check.mjs` → **6/6** (invalid order `400` names
`customer.name` and writes nothing; qty 2 → 350×2=700; qty 12 → 300×12=3600;
orders carry designs; DB restored).

**Phase 6 — cart/checkout/payment:** DONE (sandbox provider)
`scripts/phase6-check.mjs` → **7/7** (checkout `201` total 900; starts unpaid;
bad-signature webhook `400` and unchanged; signed webhook marks paid with event
id; replay `duplicate:true`; paid order carries design; DB restored).

**Phase 7 — admin:** DONE
`scripts/phase7-check.mjs` → **11/11** (sign-in + cookie; wrong password `401`;
unpaid can't enter production `409`; paid→in_production→printed→shipped; shipped
terminal `409`; events=4 with actor; design download `200`).

**Phase 8 — print-ready files:** DONE
`scripts/phase8-check.mjs` → **7/7** (PNG real, 1250×1583; artwork composited
redMean=220 alphaMean=255; text ink darkest=0; SVG carries text+image; print
requires admin `401`). Print file viewed: text + artwork on transparent bg.

**Phase 9 — deploy:** DONE (live)
`https://custom-tshirt-five.vercel.app` — home `200` with catalogue; `/admin`
`307`→`/admin/login`; `/api/orders` empty `400`; `/studio` `200`;
`/admin/login` `200`; `/api/upload` non-image `400`.

**Phase 10 — optional:** PARTLY VERIFIED
Saved designs (save/load/delete/persist) tested; AI generation returns `501
"not configured"` honestly. **UNVERIFIED:** background removal end to end (WASM
model not exercised); live AI provider path (no key).

## What broke and how I fixed it

- **Studio `500`: react-konva v19 exports no `useImage`.** Guessed it moved to
  its own package; `pnpm add use-image`, changed the import → `200`.
- **`0002` re-run: `42P07 relation "products_name_key" already exists`.** The
  first run had applied; guarded the constraint in a `DO` block so it is
  re-runnable.
- **Konva `fillRadialGradientColorStops`** — TS error; it is a **flat** array
  (`[0,"a",1,"b"]`), not `[number,string]` pairs.
- **`react-hooks/set-state-in-effect`** on mount reads from localStorage —
  justified targeted disable (design is client-only state).
- **sharp's SVG renderer cannot load raster images** (data URI, file path,
  absolute path all blank) — a print file with artwork would have been silently
  missing it. Fixed by compositing images with `sharp` directly; text still via
  SVG. (Caught by checking the actual file, not by trusting a green test.)
- **My own measurements were wrong twice:** sharp's `stats()` ignores
  `extract()`, so crop checks read the whole canvas and gave false failures.
  Fixed by materialising the crop first.
- **e2e used lowercase `#ffffff`** against seeded uppercase `#FFFFFF`.

## Claims ledger

| Claim | Proof |
|---|---|
| Design never lost on colour/size change | `pnpm e2e` "changing colour and size never loses the design" |
| Bad order saves nothing | phase5 script: `400` + order count unchanged |
| Price never invented | `409 "Pricing is not configured"` (e2e + phase5) |
| Paid only on verified webhook | phase6: bad sig `400` unchanged; signed → paid |
| Replay can't double-act | phase6: `duplicate:true` |
| Forward-only status | phase7: skips `409`; chain `200`; events logged |
| Print file has text + artwork | phase8: crops + viewed PNG |
| Live deploy works | Phase 9 curls above |
| Background removal works | **UNVERIFIED** |
| Live AI generation works | **UNVERIFIED** (no key) |
| Embroidery format correct | **UNVERIFIED** (owner value missing) |

## What I would tell the next person

1. **Prices and bulk tiers are unset**, so ordering returns `409` — intentional.
   Set them in the `settings` row to take real orders.
2. **Payment is the sandbox adapter.** Wire Razorpay/Stripe behind
   `PaymentProvider` before taking money; the webhook signature + idempotency
   path is already correct.
3. **Owner values still needed:** artwork rules, print areas, print DPI,
   embroidery file format, shipping, brand kit (palette/logo/photos).
4. The **mockup is a shaded colour panel**, not a photo-real shirt; a garment
   photo would lift it.
5. `scripts/phaseN-check.mjs` are self-cleaning end-to-end proofs — rerun them
   after any change to pricing, payments, admin or print.
