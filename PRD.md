# PRD: Sweet Ginger Custom T-Shirt Design Studio

**Owner:** Shankar Hemrajani, Sweet Ginger Fashions (Jaipur)
**Version:** 1.0 (draft for review)
**Status:** Draft — decisions below are made for v1 and flagged where they need Shankar's input
**Source brief:** `shankar.pdf` (Business Owner 2 · Requirement Brief)

---

## 1. Summary

Today a custom T-shirt order is a slow back-and-forth over WhatsApp and email. This product
replaces that with a self-serve design studio: a customer picks a blank, adds a design (text and/or
uploaded artwork), sees it live on the actual shirt, and orders it — for a single B2C order or a B2B
bulk order. The order always carries its design so the print team can reproduce it.

The shape follows CustomInk's Design Lab: **product → design → preview → price → cart → order.**

## 2. Goals

- A customer can design and order a custom T-shirt without talking to anyone.
- The design is never lost while colour, size, quantity or product changes.
- The live preview shows the design on the real shirt colour and placement.
- The price updates from product and quantity, with a bulk tier for B2B.
- An order always carries its design; an order without artwork is not printable.
- Admin can see orders with their artwork, download a print-ready file, and track status.

## 3. Non-goals (v1)

- Not a general clothing store; this is the customization flow only.
- **Payment collection is in scope** for v1 (see §6.4), but no refunds, subscriptions,
  multi-currency or stored cards. The provider is abstracted so it can be chosen later (see §5).
- No customer accounts required to design; reuse of a saved design is optional/later.
- No live shipping-provider integration; shipping is a flat/config value.
- AI design generation and background removal are optional stretch items, not v1 core.

## 4. Users

- **B2C customer** — a retail buyer ordering one (sometimes a few) custom shirts. *Leads v1.*
- **B2B buyer** — a reseller / corporate / event / printer ordering in bulk with per-size
  quantities. *Supported v1 via the same studio, but not the primary path.*
- **Admin / print operator** — sees orders with artwork, downloads print files, updates status.

## 5. Decisions made for v1

| # | Question from the brief | Decision |
|---|-------------------------|----------|
| 1 | Which vertical leads? | **The T-Shirt Shop (B2C, single orders) leads.** The same studio also accepts B2B bulk orders. |
| 2 | Standalone or inside the store? | **Standalone app.** It hands completed orders to the existing store/ops (see §9). |
| 3 | Bulk pricing model | **Quantity tiers only.** Print method does not change the price in v1. |
| 4 | Print methods | **DTF, embroidery and vinyl all supported at order time.** One design tool; the method is a field on the order. |
| 5 | Artwork rules for printers | v1 enforces the basics (PNG/JPG, a max file size, a minimum resolution, inside the print area). Exact numbers are configurable — see §8. |

Additional v1 decisions (confirmed by the owner rep on 6 Oct):

- **Payment is taken at checkout.** The provider is kept behind an abstraction so it can be chosen
  later (Razorpay for India vs Stripe); no provider is hardcoded.
- **Order handoff for v1 = the admin list + an email notification.** Direct integration into the
  existing store is a later follow-up (§9).

## 6. Scope and requirements

### 6.1 Product picker
- Browse blanks: **T-shirts first (crew, oversized, polo)**, then hoodies and caps if time allows.
- Each product has: colours, sizes, a price (B2C) and a bulk price (B2B).
- Selecting a product + colour + size is the entry into the studio.

**Acceptance:** a product with no colour/size can't be ordered; price shown matches the product and
quantity.

### 6.2 Design canvas
- After choosing product and colour, design on it: **add text** and **upload artwork (PNG/JPG)**.
- **Move, scale and rotate** each element.
- Support **front and back** of the shirt.
- Enforce a **print area** the design cannot leave.
- Text elements: **font, text colour, font size**.

**Acceptance:** an element dragged past the print area is clamped/blocked; front and back hold
independent designs; a PNG and a JPG both upload successfully.

### 6.3 Live preview
- The design sits on the **actual shirt colour**, not a generic mockup, and updates as they edit.
- It should look close to printed, not pasted on (blend/composite, not a floating sticker).
- Switching colour or size does **not** lose the design.

**Acceptance:** changing shirt colour re-renders the design on the new colour with the design
intact; changing size keeps the design and updates the price.

### 6.4 Order
- **Quantity**, **size breakdown**, and **price**, updated live.
- B2B bulk: set a **quantity per size**. B2C: usually one.
- **Cart** and a **checkout** that takes **payment** through an abstracted provider (no provider
  hardcoded), with a webhook to confirm the result.
- The **design is saved with the order** so it can be printed.
- Requires a **print method** (DTF / embroidery / vinyl) on the order.

**Acceptance:** an order with no artwork is rejected with a clear reason and saved nowhere; price
recomputes on quantity change; the saved order contains the full design data needed to reproduce it;
an order is marked **paid only after the provider confirms the payment**, never before (a failed or
abandoned payment leaves the order unpaid and unfulfilled).

### 6.5 Admin side
- A **list of orders with the design attached**.
- **Download the artwork** or a **print-ready file** for DTF, embroidery or vinyl.
- Mark an order **in production → printed → shipped**.

**Acceptance:** status can only move forward through the defined states, and only after the real
step (an order can't be marked printed before it was production, etc.). Download returns the stored
artwork/design.

### 6.6 Optional (only if time allows)
- Generate a design from a text prompt.
- Remove the background from an uploaded image.
- Save a design so a returning customer can reuse it.

## 7. Business rules (must hold)

1. The design is **never lost** when colour, size or quantity changes.
2. The preview **matches the chosen shirt colour and placement**.
3. The price updates from **product + quantity**, with a **bulk tier** for B2B.
4. An order **always carries its design**; **an order without artwork is not printable** (and is not
   accepted).
5. Both **single and bulk orders go through the same studio**.
6. Required fields (product, colour, size, quantity, at least one design element, print method,
   contact details) are validated at the edge — a bad record is rejected, saves nothing, and says
   why.
7. An order is marked **paid only after the payment provider confirms it**; a payment event that is
   not confirmed by the provider changes nothing.

## 8. Configuration Shankar must supply (do not invent)

These are slots, marked `TBD — owner` in the app, not made-up values:

- Bulk price breaks (the quantity thresholds and the price per tier).
- Base price of each product, and price per colour (and whether colour affects price).
- Any difference in price per print method (v1 assumes none — confirm).
- Artwork rules: accepted file types, max file size, minimum resolution/DPI, maximum print area per
  product and per print method.
- Shipping cost / method for v1.

## 9. Order handoff

The studio is standalone. On successful payment it produces a complete order record: customer +
shipping details, product/colour/size breakdown, the full design (text, colour, position, scale,
rotation, image URLs), quantity, print method, payment status, and price.

For v1 the record reaches ops in two ways only:

1. It appears in the **admin order list** (with artwork download).
2. An **email notification** is sent to ops when the order is paid.

Direct integration into the existing store (API, export, or embed) is a **later follow-up** and is
not assumed in v1.

## 10. Data we must store

Stored as **structured data** so an order can be reproduced for printing:

- **Product**: id, name, category (tee/hoodie/cap), colours, sizes, base price, bulk tiers.
- **Design**: shirt colour, front and back element lists; each text element = content, font,
  colour, size, x, y, scale, rotation; each image element = image URL, x, y, scale, rotation.
- **Order**: line items (product, colour, size breakdown, quantity, print method), price, status,
  payment status + provider reference, customer contact + shipping, timestamps, and the design
  snapshot used at order time.
- **Assets**: uploaded artwork URLs kept so the admin can download the original/print file.

## 11. Success criteria for v1

- A first-time B2C customer completes a design and a single order end-to-end without help.
- A B2B customer places a bulk order with per-size quantities and a correct tiered price.
- Admin downloads artwork from a real order and moves it through production → printed → shipped.
- Every rule in §7 is demonstrably true, proven by real test output (per `AGENTS.md` §1 and §3).

## 12. Risks / watch-items

- **Mockup realism** on arbitrary shirt colours is the hardest visual problem.
- **Print-file correctness** depends on artwork rules we don't have yet (§8).
- **Payment provider** is not yet chosen; the abstraction must hold so swapping providers is cheap.
- **Scope creep** from the optional AI features — keep them out of the critical path.

## 13. Open items to confirm with Shankar

- The values in §8.
- Which payment provider to switch on first (Razorpay vs Stripe) — the code supports either.
- Whether to integrate bulk orders directly into the existing store later (v1 uses list + email).

---

*Next documents, in order:* `TECH-STACK.md`, then `IMPLEMENTATION-PLAN.md` (per `AGENTS.md` §3b).
