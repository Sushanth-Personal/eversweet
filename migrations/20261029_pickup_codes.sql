-- Shared pickup locations, editable through the server-side admin settings API.
create table if not exists public.pickup_codes (
  city text primary key check (city in ('kochi', 'trivandrum', 'kozhikode')),
  code text not null default ''
);
alter table public.pickup_codes enable row level security;
insert into public.pickup_codes (city, code) values
  ('kochi', '7J2R28VM+3X'),
  ('trivandrum', 'FXQ2+35X Thiruvananthapuram, Keralam'),
  ('kozhikode', '')
on conflict (city) do nothing;
