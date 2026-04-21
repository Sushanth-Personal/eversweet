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

-- ── 2. ROW LEVEL SECURITY (RLS) ──────────────────────────────────
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_sizes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies to prevent "already exists" errors
DROP POLICY IF EXISTS "Public read products" ON products;
DROP POLICY IF EXISTS "Admin manage products" ON products;
DROP POLICY IF EXISTS "Public read box_sizes" ON box_sizes;
DROP POLICY IF EXISTS "Admin manage boxes" ON box_sizes;
DROP POLICY IF EXISTS "Public read time_slots" ON time_slots;
DROP POLICY IF EXISTS "Admin manage slots" ON time_slots;
DROP POLICY IF EXISTS "Public insert orders" ON orders;
DROP POLICY IF EXISTS "Admin manage orders" ON orders;

-- Recreate Public Read Access
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read box_sizes" ON box_sizes FOR SELECT USING (true);
CREATE POLICY "Public read time_slots" ON time_slots FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);

-- Recreate Service Role Access (for Admin Panel)
CREATE POLICY "Admin manage products" ON products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin manage slots" ON time_slots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin manage boxes" ON box_sizes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Admin manage orders" ON orders FOR ALL USING (auth.role() = 'service_role');
-- ── 3. SEED DATA ─────────────────────────────────────────────────
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


  