-- Available Trivandrum delivery dates. Only server-side service role can write.
create table if not exists public.delivery_dates (
  date date primary key,
  created_at timestamptz not null default now()
);
alter table public.delivery_dates enable row level security;
