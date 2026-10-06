# Sweet Ginger — Custom T-Shirt Design Studio

A self-serve studio for Sweet Ginger Fashions (Jaipur): pick a blank, add text
and artwork, see it on the real shirt colour, and order one or in bulk. Built to
the brief in `PRD.md`.

## Docs

- `PRD.md` — what to build, the rules, the owner-supplied values
- `TECH-STACK.md` — the stack and why
- `IMPLEMENTATION-PLAN.md` — the build order and proof for each step
- `WORKLOG.md` — one line per slice: what ran, what it printed

## Stack

Next.js (App Router) + TypeScript on Vercel · react-konva design editor ·
Supabase (Postgres, Auth, Storage) · Zod validation · Vitest + Playwright ·
`sharp` for print-ready output.

## Run locally

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill the values (see below).
3. `pnpm dev` → http://localhost:3000

### Environment (`.env.local`, never committed)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
PAYMENT_PROVIDER=          # sandbox by default
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=
RESEND_API_KEY=            # optional: ops email on a paid order
ORDER_NOTIFY_EMAIL=
ADMIN_EMAILS=              # comma-separated allowlist for /admin
```

## Database

Apply the migrations in `supabase/migrations/` in order (SQL editor or CLI):
`0001_init.sql` then `0002_owner_price_slot_and_seed.sql`.

## Tests

- `pnpm test` — unit tests (pricing, validation, transitions, print geometry)
- `pnpm e2e` — Playwright at 1440px and 375px
- `pnpm lint`, `pnpm exec tsc --noEmit`

## Status

Phases 0–8 of `IMPLEMENTATION-PLAN.md` are built and proven. Phases 9 (deploy)
and 10 (optional AI features) remain.

## Owner-supplied values (not invented)

Prices and bulk tiers, artwork rules, print areas and the embroidery file format
are placeholders until Shankar supplies them (PRD §8).
