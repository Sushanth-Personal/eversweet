-- ================================================================
-- EVERSWEET — SUPABASE DATABASE SETUP
-- Run this entire file in Supabase SQL Editor
-- Supabase Dashboard → SQL Editor → New Query → paste → Run
-- ================================================================


-- ── 1. TABLES ────────────────────────────────────────────────────

create table if not exists products (
  id          uuid    default gen_random_uuid() primary key,
  name        text    not null,
  description text,
  price       numeric not null,
  image_url   text,
  category    text    default 'mochi',
  is_available boolean default true,
  is_premium  boolean default false,
  sort_order  integer default 0,
  created_at  timestamp default now()
);

create table if not exists box_sizes (
  id         uuid    default gen_random_uuid() primary key,
  label      text    not null,
  count      integer not null,
  price      numeric not null,
  is_active  boolean default true,
  sort_order integer default 0
);

create table if not exists time_slots (
  id             uuid    default gen_random_uuid() primary key,
  label          text    not null,
  date           date    not null,
  max_orders     integer default 10,
  current_orders integer default 0,
  is_active      boolean default true
);

create table if not exists orders (
  id             uuid    default gen_random_uuid() primary key,
  customer_name  text    not null,
  phone          text    not null,
  address        text,
  dob            text,
  notes          text,
  box_size_id    uuid    references box_sizes(id),
  flavours       jsonb,
  time_slot_id   uuid    references time_slots(id),
  payment_method text,
  total_price    numeric,
  status         text    default 'pending',
  created_at     timestamp default now()
);


-- ── 2. ROW LEVEL SECURITY ────────────────────────────────────────
-- Enable RLS on all tables (secure by default)

alter table products    enable row level security;
alter table box_sizes   enable row level security;
alter table time_slots  enable row level security;
alter table orders      enable row level security;

-- Public can read products, box sizes, and time slots
create policy "Public read products"
  on products for select using (true);

create policy "Public read box_sizes"
  on box_sizes for select using (true);

create policy "Public read time_slots"
  on time_slots for select using (true);

-- Public can insert orders (no login needed)
create policy "Public insert orders"
  on orders for insert with check (true);

-- Service role (used by API routes) can do everything
-- This is handled automatically by the service_role key


-- ── 3. SEED DATA ─────────────────────────────────────────────────

-- Box sizes
insert into box_sizes (label, count, price, sort_order) values
  ('Box of 4',  4,  100, 1),
  ('Box of 6',  6,  150, 2),
  ('Box of 8',  8,  190, 3),
  ('Box of 12', 12, 270, 4),
  ('Box of 16', 16, 340, 5);

-- Products (add your real image URLs later via Admin panel)
insert into products (name, description, price, is_premium, sort_order) values
  ('Matcha Red Bean',      'Earthy matcha shell with sweet red bean paste',        30, true,  1),
  ('Strawberry Cloud',     'Fresh strawberry with light whipped cream filling',    32, true,  2),
  ('Dark Chocolate Fudge', 'Rich dark chocolate ganache at the centre',            30, true,  3),
  ('Black Sesame Maracuja','Nutty black sesame with passionfruit brightness',      28, true,  4),
  ('Mango Coconut',        'Tropical mango with coconut cream',                    25, false, 5),
  ('Classic Vanilla',      'Soft vanilla bean mochi with a pure, simple flavour', 22, false, 6);

-- Time slots for today and tomorrow (you can add more from Admin panel)
insert into time_slots (label, date, max_orders) values
  ('5:00 PM – 6:00 PM', current_date,     10),
  ('6:00 PM – 7:00 PM', current_date,     8),
  ('5:00 PM – 6:00 PM', current_date + 1, 10),
  ('6:00 PM – 7:00 PM', current_date + 1, 10);
