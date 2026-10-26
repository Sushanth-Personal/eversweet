-- Additive migration. Review and apply separately; never run automatically on startup.
create table if not exists public.preparation_progress (
  delivery_date date not null,
  city text not null check(city in ('kochi','trivandrum')),
  flavour_id text not null,
  finished integer not null default 0 check(finished>=0 and finished<=100000),
  primary key(delivery_date,city,flavour_id)
);
alter table public.preparation_progress enable row level security;
grant all on public.preparation_progress to service_role;

create table if not exists public.order_packing (
  order_id uuid primary key references public.orders(id),
  delivery_date date not null,
  city text not null check (city in ('kochi','trivandrum')),
  flavours jsonb not null,
  packed_at timestamptz default now(),
  dispatched_at timestamptz
);
alter table public.order_packing enable row level security;
alter table public.order_packing alter column packed_at drop not null;
grant all on public.order_packing to service_role;

-- All inventory mutations share one transaction lock. This also serializes order edits
-- against packing, preventing a stale box plan from consuming the wrong inventory.
create or replace function public.production_action(p_action text, p_order_id uuid default null,
  p_date date default null, p_entries jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; r record; b jsonb; plan jsonb; counts jsonb := '{}';
  city_name text; consumed integer; made integer; qty integer; capacity integer;
begin
  perform pg_advisory_xact_lock(2601026);
  if p_action = 'prepare' then
    for b in select * from jsonb_array_elements(p_entries) loop
      select coalesce(sum((flavours->>(b->>'flavour_id'))::integer),0) into consumed
        from order_packing where delivery_date=p_date and city=b->>'city';
      select consumed+coalesce(sum((flavours->>(b->>'flavour_id'))::integer),0) into consumed
        from orders where delivery_date=p_date and status='dispatched'
        and (case when source='trivandrum' then 'trivandrum' else 'kochi' end)=b->>'city'
        and not exists(select 1 from order_packing where order_id=orders.id);
      if (b->>'finished')::integer < consumed then raise exception 'Already packed pieces cannot be removed from preparation.'; end if;
      insert into preparation_progress(delivery_date,city,flavour_id,finished)
        values(p_date,b->>'city',b->>'flavour_id',(b->>'finished')::integer)
        on conflict(delivery_date,city,flavour_id) do update set finished=excluded.finished;
    end loop;
    return jsonb_build_object('saved',true);
  end if;
  select * into o from orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_action in ('pack','prepare_order') then
    if exists(select 1 from order_packing where order_id=o.id) then
      if p_action='pack' then update order_packing set packed_at=coalesce(packed_at,now()) where order_id=o.id; end if;
      return jsonb_build_object('saved',true);
    end if;
    if o.status in ('cancelled','dispatched') then raise exception 'This order cannot be packed'; end if;
    if o.delivery_date is null or coalesce(o.delivery_slot,'')='' then raise exception 'Add the delivery date and time first'; end if;
    city_name:=case when o.source='trivandrum' then 'trivandrum' else 'kochi' end;
    -- Decode the existing URI-encoded Box layout without altering historical notes.
    if o.notes like '%Box layout:%' then
      select convert_from(decode(string_agg(case when substr(v[1],1,1)='%' then substr(v[1],2) else encode(convert_to(v[1],'UTF8'),'hex') end,''),'hex'),'UTF8')::jsonb into plan
      from regexp_matches(trim(split_part(split_part(o.notes,'Box layout:',2),' | ',1)), '(%[0-9A-Fa-f]{2}|[^%])','g') m(v);
    else
      plan:=jsonb_build_array(jsonb_build_object('box_size_id',o.box_size_id,'flavours',o.flavours));
      if coalesce(substring(o.notes from 'Box quantity: ([0-9]+)'),'1')<>'1' then raise exception 'Open and save this legacy order’s individual boxes first'; end if;
    end if;
    if jsonb_array_length(plan)=0 then raise exception 'Add boxes first'; end if;
    for b in select * from jsonb_array_elements(plan) loop
      select count into capacity from box_sizes where id=(b->>'box_size_id')::uuid;
      select coalesce(sum(value::integer),0) into qty from jsonb_each_text(b->'flavours');
      if capacity is null or qty<>capacity then raise exception 'Each box must have exactly its required flavours'; end if;
      for r in select key,value::integer as n from jsonb_each_text(b->'flavours') loop
        if r.n<0 then raise exception 'Invalid flavour quantity'; end if;
        if r.n=0 then continue; end if;
        counts:=jsonb_set(counts,array[r.key],to_jsonb(coalesce((counts->>r.key)::integer,0)+r.n));
      end loop;
    end loop;
    if counts<>(select coalesce(jsonb_object_agg(key,to_jsonb(value::integer)),'{}'::jsonb) from jsonb_each_text(o.flavours::jsonb) where value::integer>0) then raise exception 'Box quantities have changed. Open and save the order first.'; end if;
    for r in select key,value::integer as n from jsonb_each_text(counts) loop
      select coalesce(sum(finished),0) into made from preparation_progress where delivery_date=o.delivery_date and city=city_name and flavour_id=r.key;
      select coalesce(sum((flavours->>r.key)::integer),0) into consumed from order_packing where delivery_date=o.delivery_date and city=city_name;
      select consumed+coalesce(sum((flavours->>r.key)::integer),0) into consumed from orders x
        where x.delivery_date=o.delivery_date and x.status='dispatched'
        and (case when x.source='trivandrum' then 'trivandrum' else 'kochi' end)=city_name
        and not exists(select 1 from order_packing where order_id=x.id);
      if p_action='prepare_order' then
        insert into preparation_progress(delivery_date,city,flavour_id,finished)
          values(o.delivery_date,city_name,r.key,greatest(made,consumed+r.n))
          on conflict(delivery_date,city,flavour_id) do update set finished=excluded.finished;
      elsif made-consumed<r.n then raise exception 'Prepared inventory changed. Refresh and prepare the remaining pieces.'; end if;
    end loop;
    insert into order_packing(order_id,delivery_date,city,flavours,packed_at) values(o.id,o.delivery_date,city_name,counts,case when p_action='pack' then now() else null end);
  elsif p_action in ('unpack','unprepare') then
    if o.status='dispatched' then raise exception 'Dispatched orders cannot be unpacked'; end if;
    if p_action='unprepare' and exists(select 1 from order_packing where order_id=o.id and packed_at is not null) then raise exception 'Unpack this order in Dispatch first'; end if;
    delete from order_packing where order_id=o.id;
  elsif p_action='reset_order' then
    city_name:=case when o.source='trivandrum' then 'trivandrum' else 'kochi' end;
    -- Remove this order's produced allocation, not another order's reserved stock.
    for r in select key,value::integer as n from jsonb_each_text(o.flavours::jsonb) where value::integer>0 loop
      select coalesce(sum((flavours->>r.key)::integer),0) into consumed from order_packing where delivery_date=o.delivery_date and city=city_name and order_id<>o.id;
      select consumed+coalesce(sum((flavours->>r.key)::integer),0) into consumed from orders x
        where x.id<>o.id and x.delivery_date=o.delivery_date and x.status='dispatched'
        and (case when x.source='trivandrum' then 'trivandrum' else 'kochi' end)=city_name
        and not exists(select 1 from order_packing where order_id=x.id);
      update preparation_progress set finished=greatest(consumed,finished-r.n)
        where delivery_date=o.delivery_date and city=city_name and flavour_id=r.key;
    end loop;
    delete from order_packing where order_id=o.id;
    update orders set status='confirmed' where id=o.id;
  elsif p_action='dispatch' then
    if o.status='dispatched' then return jsonb_build_object('dispatched',true); end if;
    if not exists(select 1 from order_packing where order_id=o.id and packed_at is not null) then raise exception 'Pack this order before dispatching'; end if;
    update order_packing set dispatched_at=now() where order_id=o.id;
    update orders set status='dispatched' where id=o.id;
  else raise exception 'Unknown production action';
  end if;
  return jsonb_build_object('saved',true);
end $$;
revoke all on function public.production_action(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.production_action(text,uuid,date,jsonb) to service_role;

create or replace function public.guard_packed_order() returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(2601026);
  if exists(select 1 from public.order_packing where order_id=old.id) then
    if new.delivery_date is distinct from old.delivery_date or new.source is distinct from old.source
      or new.flavours is distinct from old.flavours or new.box_size_id is distinct from old.box_size_id
      or split_part(split_part(coalesce(new.notes,''),'Box layout:',2),' | ',1) is distinct from split_part(split_part(coalesce(old.notes,''),'Box layout:',2),' | ',1)
      or new.status='cancelled' then
      raise exception 'Unpack this order or release its prepared pieces before changing boxes, date, city or cancelling it.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_packed_order on public.orders;
create trigger guard_packed_order before update on public.orders for each row execute function public.guard_packed_order();
notify pgrst, 'reload schema';
