# TECH-STACK: Sweet Ginger Custom T-Shirt Design Studio

**Companion to:** `PRD.md`
**Status:** Draft for review
**Rule followed:** `AGENTS.md` §1 — anything not verified is marked `UNVERIFIED:`; version numbers below
are the toolchain I actually checked on this machine, not invented.

---

## 0. Local toolchain (verified)

Checked on this machine with real commands:

```
$ node -v        -> v24.16.0
$ npm -v         -> 11.13.0
$ git --version  -> git version 2.24.3 (Apple Git-128)
$ pnpm           -> /usr/local/bin/pnpm  (available)
$ vercel / supabase CLI -> not installed yet
```

Everything below is chosen to run on this toolchain. Exact package versions get pinned in
`package.json` at install time (each install's output will be the evidence).

---

## 1. The stack at a glance

| Layer | Choice | Why |
|-------|--------|-----|
| Front end | **Next.js (App Router) + TypeScript** | Brief suggests it; server routes give us an edge for validation and print-file generation in one codebase. |
| Deploy | **Vercel** | Brief suggests it; zero-config for Next.js; matches `AGENTS.md` §5. |
| Design editor | **react-konva (Konva.js)** | Purpose-built for drag / scale / rotate / z-order, which §6.2 needs. |
| Mockup realism | **Konva blend modes on a shirt image** | Canvases render the design with `multiply`/`multiply`-style blending over the shirt colour so it looks printed, not pasted (PRD §6.3). |
| Database | **Supabase Postgres** | Brief suggests Supabase or Neon; Postgres fits the structured-design requirement (PRD §10). |
| Auth | **Supabase Auth** (customer optional, admin required) | Admin side (PRD §6.5) needs login; bundled with Supabase. |
| File storage | **Supabase Storage** | PRD §10 needs artwork kept as URLs the admin can download. |
| Validation | **Zod** at every API edge | Enforces PRD §7 rule 6 — reject bad records, save nothing. |
| Editor state | **Zustand** | Small, keeps design state stable across colour/size changes (PRD §7 rule 1). |
| Unit tests | **Vitest** | Fast, TypeScript-native; proves pricing, validation, design-serialisation. |
| E2E + screenshots | **Playwright** | Drives the real browser; produces the 1440px/375px screenshots `AGENTS.md` §3c asks for as evidence. |
| Print-ready files | **`sharp` (server-side) + SVG generation** | Raster composite for DTF/vinyl; vector output path for embroidery. See §4. |
| Payments | **Provider-agnostic `PaymentProvider` interface** (adapter per vendor) | Owner rep chose "decide later, abstract it". Checkout calls the interface; a Razorpay or Stripe adapter is dropped in without touching checkout logic. See §5. |
| Order notification | **Resend** (email) | In scope v1 (owner rep decision): a paid order emails ops. Part of the v1 handoff, not optional. See §6. |
| Package manager | **pnpm** | Verified present; faster, strict deps. |

---

## 2. Data model (Postgres / Supabase)

Mirrors PRD §10. Designs stored as **structured JSON**, not a flattened image, so any order can be
re-opened and reproduced.

- `products` — id, name, category (`tee` | `hoodie` | `cap`), `base_price` (nullable = "TBD — owner", PRD §8), `bulk_tiers` (jsonb, owner-supplied), `print_areas` (jsonb), `active`.
- `product_colors` — product_id, name, hex.
- `product_sizes` — product_id, label, order.
- `designs` — id, shirt_color, front_elements (jsonb), back_elements (jsonb), `asset_urls` (text[]), created_at.
  - element shape: text `{ kind:'text', content, font, color, size, x, y, scale, rotation }`; image `{ kind:'image', url, x, y, scale, rotation }`.
- `orders` — id, design_id (FK, **not null**), quantity, size_breakdown (jsonb), print_method (`dtf`|`embroidery`|`vinyl`), unit_price, total_price, status, customer (jsonb), shipping (jsonb), created_at.
- `order_status_events` — order_id, from, to, at, by — so status only moves forward through real steps (PRD §6.5).
- `settings` — single-row config for owner-supplied values from PRD §8 (so nothing is hardcoded).

**Constraint that encodes a rule:** an order row cannot exist without a `design_id` and a design must
have at least one element — the "order without artwork is not printable" rule (PRD §7 rule 4) becomes
a database-level guarantee, not just a UI check.

## 3. Edge validation (PRD §7 rule 6)

Every write goes through a Next.js route handler that Zod-parses the payload before touching the DB.
A rejected request returns `400` with named missing fields and **writes nothing**. This is the exact
failure the pilot punished (`AGENTS.md` §3) — a bad record must not save. Tests will assert the
negative case first.

## 4. Print-ready output (server-side)

- **DTF & vinyl** — composite the design onto a transparent high-resolution canvas server-side with
  `sharp`; output PNG at the resolution the printer wants. Resolution/limits are the owner-supplied
  values in PRD §8, stored in `settings`, never hardcoded.
- **Embroidery** — prefer a vector path (SVG) so thread software can use it; a raster PNG fallback
  is kept. `UNVERIFIED:` the exact embroidery file format his machines need — must be confirmed
  before this part is called done.
- The admin download returns the **stored original artwork** plus the generated print file.

## 5. Payments (abstracted)

Payment is taken at checkout, but **no provider is hardcoded** (owner rep: "decide later, abstract
it").

- A single `PaymentProvider` interface: `createIntent(order)`, `confirm(webhookPayload)`,
  `verifySignature(rawBody, headers)`.
- Adapters implement it per vendor (a Razorpay adapter, a Stripe adapter). Checkout and the order
  code depend only on the interface.
- Confirmation arrives by **webhook**, not by trusting the browser redirect. Signature is verified
  before anything is written.
- **An order is marked paid only inside the verified webhook handler** (PRD §7 rule 7). The same
  event applied twice must not charge or mark twice — the provider event id is stored and deduped.
- Provider keys stay server-side only (PRD §7; `AGENTS.md` §8).

## 6. Order handoff (standalone → ops)

v1 handoff, as decided:

1. Order is saved in Supabase with its design snapshot and payment status.
2. Admin list shows it; admin can download artwork/print file.
3. **Resend email** notifies ops when an order is paid.

Pushing orders directly into the existing store is a **later integration**, listed as a follow-up —
its mechanism depends on what the current store exposes, which we don't know yet. No store API is
assumed or invented.

## 7. Rejected options and why

- **Neon + Vercel Blob** instead of Supabase — viable, but splits Postgres, auth and storage across
  two vendors for no benefit here. Supabase bundles all three, fewer moving parts.
- **Fabric.js** instead of Konva — also capable; Konva's React bindings (`react-konva`) fit the
  Next.js/React codebase more cleanly and its transform controls cover move/scale/rotate directly.
- **Static site + client-only cart** — rejected: server-side validation (rule 6), auth for admin,
  print-file generation, and a trusted payment webhook all need a server, so Next.js route handlers
  are used.
- **Picking a payment vendor now** — rejected: the owner rep asked to decide later, so the interface
  is built first and a vendor chosen behind it.

## 8. Repo / branch rules

- New repo, **never** touching Shankar's existing projects, DNS or repos (`AGENTS.md` §6).
- Secrets in server-side env vars only (Supabase service key, payment provider secret, webhook
  signing secret, Resend key), never in the browser or a committed file (`AGENTS.md` §8).
  `.gitignore` includes `.env*` before the first commit.
- `.env.example` documents required keys **without values**.

## 9. Testing strategy (the proof layer)

- **Vitest** — pricing with bulk tiers, Zod rejection of bad orders, design serialise/deserialise,
  status transition legality, and **payment webhook handling** (signature verify, idempotency, paid
  set only on a confirmed event).
- **Playwright** — the full B2C flow (pick → design → preview → order) and a B2B bulk flow; plus
  screenshots at **1440px and 375px** as the evidence `AGENTS.md` §3c requires.
- Every slice's real command + output goes into `WORKLOG.md` (`AGENTS.md` §2).

## 10. What still needs a real-world answer

- Exact print-file formats Shankar's DTF / embroidery / vinyl workflows accept (PRD §8).
- **Which payment provider** to switch on first (Razorpay vs Stripe) — the code supports either.
- The picture / logo / brand kit files for the UI (`AGENTS.md` §3c) — none are in this folder yet,
  so the app will be built in one strong direction of our own until Shankar supplies them.

---

*Next document:* `IMPLEMENTATION-PLAN.md`, built against `PRD.md` and this file.
