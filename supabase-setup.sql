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
alter table products    enable row level security;
alter table box_sizes   enable row level security;
alter table time_slots  enable row level security;
alter table orders      enable row level security;

create policy "Public read products" on products for select using (true);
create policy "Public read box_sizes" on box_sizes for select using (true);
create policy "Public read time_slots" on time_slots for select using (true);
create policy "Public insert orders" on orders for insert with check (true);

-- ── 3. SEED DATA ─────────────────────────────────────────────────
-- Clear existing data
delete from orders;
delete from box_sizes;
delete from products;

-- Sync Box Sizes (Correct Pricing)
insert into box_sizes (label, count, price, sort_order) values
  ('Box of 4',  4,  499,  1),
  ('Box of 6',  6,  699,  2),
  ('Box of 8',  8,  899,  3),
  ('Box of 12', 12, 1299, 4),
  ('Box of 16', 16, 1699, 5);

-- Sync All 11 Products (Correct Images & Descriptions)
insert into products (name, description, price, image_url, is_premium, sort_order) values
  ('Mango Mochi', 'Sweet Alphonso mango filling wrapped in a soft, pillowy mochi skin. Pure and tropical.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mango-mochi.png', false, 1),
  ('Mango Passion Fruit Mochi', 'Mango meets tangy curd in a creamy layered filling. Sweet with a gentle sour finish.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mangopassioncurd.png', false, 2),
  ('Strawberry Mochi', 'Fresh strawberry pulp and real fruit pieces wrapped in a soft mochi shell. Juicy, bright, and naturally sweet.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/mochi-strawberry.webp', false, 3),
  ('Blueberry', 'Rich blueberry compote centre with deep berry flavour and a natural purple hue.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/blueberry.png', false, 4),
  ('Kiwi', 'Bright, slightly tart kiwi filling — a refreshing contrast to the sweet mochi skin.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/kiwi.png', false, 5),
  ('Biscoff', 'Caramelised Biscoff spread filling with warm spiced cookie notes. A fan favourite.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/biscoff.png', true, 6),
  ('Hazelnut', 'Smooth roasted hazelnut cream. Rich, nutty, and indulgent in every bite.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/hazlenut.png', true, 7),
  ('Chococrisp', 'Dark chocolate ganache with a crispy feuilletine layer inside. Texture and richness together.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/chococrisp.png', true, 8),
  ('Coffeecrisp', 'Espresso cream with a crispy centre. A pick-me-up in every bite.', 0, NULL, true, 9),
  ('KitKat', 'Chocolate cream with crushed KitKat pieces folded in. Crunchy, chocolatey, and fun.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/kitkat.png', false, 10),
  ('Nutella', 'Classic Nutella filling — hazelnut chocolate that melts right into the soft mochi shell.', 0, 'https://lqokriiytzrzkonedrwe.supabase.co/storage/v1/object/public/products/nutella.png', false, 11);