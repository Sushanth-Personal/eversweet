create table if not exists public.preparation_progress (
 delivery_date date not null,
 city text not null check (city in ('kochi','trivandrum')),
 flavour_id text not null,
 finished integer not null default 0 check (finished >= 0 and finished <= 100000),
 primary key (delivery_date,city,flavour_id)
);
alter table public.preparation_progress enable row level security;
