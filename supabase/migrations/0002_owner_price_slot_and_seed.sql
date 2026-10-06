-- 0002_owner_price_slot_and_seed.sql
-- 1) Base price is owner-supplied (PRD section 8), so it must be allowed to be
--    empty until Shankar confirms it. We never invent a price.
-- 2) Seed the three T-shirt blanks the brief names, plus standard sizes and a
--    minimal placeholder colour set. Colours/sizes are owner-editable; the price
--    stays NULL on purpose.

alter table products alter column base_price drop not null;

-- Guard so this migration can be re-run without "constraint already exists".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_name_key'
  ) then
    alter table products add constraint products_name_key unique (name);
  end if;
end $$;

insert into products (name, category) values
  ('Crew Neck Tee', 'tee'),
  ('Oversized Tee', 'tee'),
  ('Polo Tee', 'tee')
on conflict (name) do nothing;

-- Standard tee sizes (owner-editable).
insert into product_sizes (product_id, label, sort_order)
select p.id, s.label, s.ord
from products p
cross join (values ('S', 1), ('M', 2), ('L', 3), ('XL', 4), ('XXL', 5)) as s(label, ord)
where p.category = 'tee'
on conflict (product_id, label) do nothing;

-- Placeholder neutral colourways — to be confirmed with the owner.
insert into product_colors (product_id, name, hex)
select p.id, c.name, c.hex
from products p
cross join (values ('Black', '#000000'), ('White', '#FFFFFF'), ('Navy', '#1B2A4A')) as c(name, hex)
where p.category = 'tee'
on conflict (product_id, name) do nothing;
