-- 0001_init.sql
-- Schema for the Sweet Ginger Custom T-Shirt Design Studio.
-- Mirrors PRD section 10 / TECH-STACK section 2. Constraints below deliberately
-- encode business rules so the database refuses bad data, not just the UI.

create extension if not exists pgcrypto;

-- Products ----------------------------------------------------------------

create type product_category as enum ('tee', 'hoodie', 'cap');

create table products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      product_category not null,
  base_price    numeric(10,2) not null check (base_price >= 0),
  -- owner-supplied, empty until Shankar fills PRD section 8
  bulk_tiers    jsonb not null default '[]'::jsonb,
  print_areas   jsonb not null default '{}'::jsonb,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table product_colors (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  name        text not null,
  hex         text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  unique (product_id, name)
);

create table product_sizes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  label       text not null,
  sort_order  int not null default 0,
  unique (product_id, label)
);

-- Designs -----------------------------------------------------------------

create table designs (
  id             uuid primary key default gen_random_uuid(),
  shirt_color    text not null,
  front_elements jsonb not null default '[]'::jsonb,
  back_elements  jsonb not null default '[]'::jsonb,
  asset_urls     text[] not null default '{}',
  created_at     timestamptz not null default now(),
  -- PRD rule 4: a design with no element is not printable.
  constraint design_has_element check (
    jsonb_typeof(front_elements) = 'array'
    and jsonb_typeof(back_elements) = 'array'
    and (jsonb_array_length(front_elements) + jsonb_array_length(back_elements)) >= 1
  )
);

-- Orders ------------------------------------------------------------------

create type print_method as enum ('dtf', 'embroidery', 'vinyl');
create type order_status as enum ('pending_payment', 'paid', 'in_production', 'printed', 'shipped');
create type payment_status as enum ('unpaid', 'paid', 'failed');

create table orders (
  id                uuid primary key default gen_random_uuid(),
  -- PRD rule 4: an order always carries its design. Not nullable, on purpose.
  design_id         uuid not null references designs(id),
  quantity          int not null check (quantity >= 1),
  size_breakdown    jsonb not null default '{}'::jsonb,
  print_method      print_method not null,
  unit_price        numeric(10,2) not null check (unit_price >= 0),
  total_price       numeric(10,2) not null check (total_price >= 0),
  status            order_status not null default 'pending_payment',
  payment_status    payment_status not null default 'unpaid',
  payment_provider  text,
  payment_ref       text,
  -- PRD rule 7: the provider event id is unique, so a replayed webhook cannot act twice.
  payment_event_id  text unique,
  customer          jsonb not null,
  shipping          jsonb not null,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  -- paid only holds together if it was actually confirmed.
  constraint paid_requires_confirmation check (
    (payment_status = 'paid' and paid_at is not null and payment_event_id is not null)
    or payment_status <> 'paid'
  )
);

create table order_status_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  from_state order_status,
  to_state   order_status not null,
  at         timestamptz not null default now(),
  actor      text
);

-- Settings (single row) ---------------------------------------------------

create table settings (
  id          int primary key default 1 check (id = 1),
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Owner-supplied config slots for PRD section 8. Empty on purpose: never invented.
insert into settings (id, data) values (1, jsonb_build_object(
  'bulk_price_breaks', null,
  'price_per_color', null,
  'print_method_price_difference', null,
  'artwork_rules', jsonb_build_object(
    'accepted_types', null,
    'max_file_size_bytes', null,
    'min_resolution_dpi', null
  ),
  'print_areas', null,
  'shipping', null
)) on conflict (id) do nothing;
