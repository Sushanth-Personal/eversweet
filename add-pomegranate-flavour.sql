-- Safe to run more than once in the Supabase SQL editor.
insert into products (id, name, description, price, image_url, category, is_available, is_premium, sort_order)
values (
  '00000000-0000-4000-8000-000000000017',
  'Pomegranate',
  'Bright, fruity pomegranate filling.',
  0,
  null,
  'mochi',
  true,
  false,
  17
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_available = true,
  sort_order = excluded.sort_order;
