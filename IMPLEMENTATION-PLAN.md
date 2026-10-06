# IMPLEMENTATION-PLAN: Sweet Ginger Custom T-Shirt Design Studio

**Companion to:** `PRD.md` (what) and `TECH-STACK.md` (with what)
**Status:** Draft for review
**Rule followed:** `AGENTS.md` §2 — the smallest piece that can be proven, proven, then the next.
This plan is built to the order below. If a step is wrong, I stop and say so rather than reordering
it silently (`AGENTS.md` §3b).

---

## How to read this plan

Each slice is **one provable piece**. A slice is done only when:

1. It runs, and I paste the **real output** (`AGENTS.md` §1).
2. It has a **negative test** that fails if the feature is wrong (`AGENTS.md` §3).
3. The command + printed output is added to `WORKLOG.md`.

Screens/screenshots are checked at **1440px and 375px** (`AGENTS.md` §3c).

**Owner-supplied values (PRD §8)** are built as empty `settings` slots, never hardcoded. Until
Shankar fills them, the app shows the slot as a placeholder and the plan does not invent numbers.

---

## Phase 0 — Scaffold, running and proven

**Slices**

- 0.1 Create the Next.js + TypeScript app (App Router) with pnpm, in a **new repo**.
- 0.2 Add Vitest + Playwright; one trivial passing test of each.
- 0.3 Add `.gitignore` (with `.env*`) and `.env.example` (names only, no values). First commit.

**Prove it**

```
pnpm dev            -> local server prints its ready line; screenshot loads at 1440px and 375px
pnpm test           -> the one Vitest test passes (paste output)
pnpm exec playwright test -> the one Playwright test passes (paste output)
```

**Done when:** the app boots locally, both test runners pass, and no secret is committed.

---

## Phase 1 — Data model and config slots

**Slices**

- 1.1 Provision Supabase (Postgres + Storage); create the tables in `TECH-STACK.md` §2.
- 1.2 Seed the products Shankar named (tees: crew, oversized, polo; then hoodies, caps).
- 1.3 Create the `settings` row with **empty** owner slots from PRD §8 (tiers, artwork rules,
  print areas, shipping) and a Zod schema that marks them required-once-set but allows
  placeholder in dev.
- 1.4 Encode the DB constraints: order requires `design_id`; design requires ≥1 element.

**Prove it**

- A migration run prints success; a query returns the seeded products.
- Negative: inserting an order with no `design_id` is **rejected by the database** (paste the error).

**Done when:** products and settings exist, and the "order without artwork" rule is enforced at the
database, not just the UI.

---

## Phase 2 — Product picker (PRD §6.1)

**Slices**

- 2.1 Product list page (tees first) wired to real DB rows.
- 2.2 Colour + size selection; price shown from data.
- 2.3 Hand off selection into the studio route.

**Prove it**

- Playwright: pick a tee → choose colour + size → arrive in the studio.
- Negative: cannot proceed without colour and size; paste the blocked state.

**Done when:** a product with no colour/size cannot be ordered, and the shown price matches the row.

---

## Phase 3 — Design canvas (PRD §6.2)

**Slices**

- 3.1 Add text elements: content, font, colour, size.
- 3.2 Upload artwork (PNG/JPG) → Supabase Storage → element on the canvas.
- 3.3 Move / scale / rotate an element.
- 3.4 Front and back canvases, each independent.
- 3.5 Print-area boundary that the design cannot leave.

**Prove it**

- Playwright: add text, upload a PNG and a JPG, move/scale/rotate, edit front and back.
- Negative: dragging past the print area is clamped/blocked; an oversized or wrong-type upload is
  rejected with a reason and saves nothing (`AGENTS.md` §3).
- Negative: front and back designs stay independent (editing one does not change the other).

**Done when:** both element types work on both sides inside the print area.

---

## Phase 4 — Live preview and design persistence (PRD §6.3, §7 rules 1 & 2)

**Slices**

- 4.1 Composite the design onto the real shirt colour with blend modes (printed, not pasted).
- 4.2 Serialise the design to structured JSON on every change.
- 4.3 Keep the design intact through colour and size changes.

**Prove it**

- Playwright screenshots at 1440px and 375px in at least two shirt colours.
- Negative: change colour, then size, then quantity → the design JSON is unchanged; paste the
  before/after.

**Done when:** the preview matches shirt colour + placement, and no design change ever loses work.

---

## Phase 5 — Pricing and edge validation (PRD §6.4, §7 rules 3 & 6)

**Slices**

- 5.1 Price = product price × quantity, with **quantity-tier** breaks from `settings`.
- 5.2 Zod validation of the whole order payload at the API edge.
- 5.3 Size breakdown (per-size quantity for bulk; one for B2C).

**Prove it**

- Vitest: tier boundary tests (just below / at / just above each break); paste results.
- Negative: an order with a missing required field (no contact, no print method, no design element)
  returns `400`, names the field, and **writes nothing** — the test that matters most
  (`AGENTS.md` §3).

**Done when:** price recomputes on quantity change and bad records are impossible to save.

---

## Phase 6 — Cart, checkout, payment, order (PRD §6.4, §7 rules 4, 5 & 7)

**Slices**

- 6.1 Cart for one or more line items.
- 6.2 Checkout form (contact + shipping) validated the same way.
- 6.3 `PaymentProvider` interface + one adapter behind it (vendor chosen later; may be a test/sandbox
  adapter first so the flow is provable without a live account).
- 6.4 Payment confirmation via **verified webhook only**; order marked paid **only** there; event id
  deduped so a repeated webhook does not double-act.
- 6.5 Persist the order with its **design snapshot**; print method captured.
- 6.6 **Resend email to ops** on a paid order.
- 6.7 Confirmation page.

**Prove it**

- Playwright: complete a **B2C single order** and a **B2B bulk order** through the same studio
  (using the sandbox adapter).
- Query the DB: the saved order carries the full design JSON, print method and payment status; paste
  the row.
- Negative (the rule-7 test): a webhook with a **bad signature** changes nothing; a **replayed**
  webhook does not mark paid twice; an order stays **unpaid** when the payment is abandoned. Paste
  each result.

**Done when:** both order types complete end-to-end, every order is printable, and status/paid only
change on a provider-confirmed event.

Note: switching on a **live** payment provider needs the vendor decision (PRD §13) and real keys —
that is a stop-and-ask before any live charge.

---

## Phase 7 — Admin (PRD §6.5)

**Slices**

- 7.1 Supabase Auth login, admin role only.
- 7.2 Order list with design preview.
- 7.3 Download stored artwork / print file.
- 7.4 Status transitions **in production → printed → shipped**, logged in `order_status_events`.

**Prove it**

- Playwright: log in, open an order, move it through the three states, download the file.
- Negative: illegal transitions (e.g. shipped before production) are rejected; paste the error.

**Done when:** admin sees real orders with artwork, downloads it, and status can only move forward
through steps that actually happened (`AGENTS.md` §3).

---

## Phase 8 — Print-ready file generation (TECH-STACK §4)

**Slices**

- 8.1 Server-side `sharp` composite → high-res PNG for **DTF / vinyl**, using owner-supplied
  resolution/limits.
- 8.2 Vector (SVG) path for **embroidery**; raster fallback.

**Prove it**

- Generate a file from a real order; open it and confirm dimensions and that the design is inside
  the print area; paste file info.
- `UNVERIFIED:` exact embroidery format Shankar's machines need — this slice is not "done" until
  that is confirmed with him.

**Done when:** admin can hand a printer a file that matches the owner's stated specs.

---

## Phase 9 — Deploy (PRD §9, `AGENTS.md` §5)

**Slices**

- 9.1 Build locally, run locally, fetch the page.
- 9.2 Deploy to Vercel; set every env var the app reads.
- 9.3 Fetch the live URL and paste the status line. A 404/500 means the deploy failed whatever the
  CLI said.

**Done when:** the live URL is fetched and returns 200, with the status line pasted as evidence.

---

## Phase 10 — Optional, only if time remains (PRD §6.6)

Text-prompt design generation, background removal, saved/reusable designs. Kept off the critical
path; only started after Phases 0–9 are proven.

---

## Cross-cutting, done throughout

- `WORKLOG.md` gets one line per slice (command + real output).
- Screens where relevant are looked at at 1440px and 375px before being called done.
- Brand kit: **none exists in this folder yet** (`AGENTS.md` §3c), so the app is built in one strong
  direction of our own — one neutral, one accent used sparingly, one type pairing, the required
  spacing — and this is stated to Shankar. When he supplies a palette, logo and pictures, they are
  swapped in.
- `REPORT.md` written at the end in the shape `AGENTS.md` §10 requires.

## Sequenced dependency map

```
Phase 0  scaffold
  └─ Phase 1  data + config slots
       ├─ Phase 2  product picker
       │    └─ Phase 3  canvas
       │         └─ Phase 4  live preview
       │              └─ Phase 5  pricing + validation
       │                   └─ Phase 6  cart / order
       │                        ├─ Phase 7  admin
       │                        │    └─ Phase 8  print files
       │                        └─ Phase 9  deploy
       └─ Phase 10 optional (after everything above)
```

## What would make me stop and ask (not guess)

- A wrong step in this plan (`AGENTS.md` §3b says stop, don't reorder).
- Any owner-supplied value in PRD §8 before it can be called done.
- Choosing and switching on a **live payment provider** (a real charge) — needs the vendor decision
  and real keys first; the sandbox adapter proves the flow until then.
- Direct store integration, if it is ever wanted (v1 is admin list + email).

---

*This completes the three documents `AGENTS.md` §3b requires: `PRD.md`, `TECH-STACK.md`,
`IMPLEMENTATION-PLAN.md`.*
