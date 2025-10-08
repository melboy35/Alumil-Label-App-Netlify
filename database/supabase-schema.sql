-- SUPABASE SCHEMA FOR LABEL APP (run in SQL editor)
-- FIXED VERSION: Removed 'if not exists' from CREATE POLICY statements

-- 1) Helper: admin check
create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- 2) Profiles (links to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- RLS: user sees own profile; admins see all; admins can update roles
create policy "read own profile" on public.profiles
for select using ( id = auth.uid() );

create policy "admins read all profiles" on public.profiles
for select using ( public.is_admin() );

create policy "insert own profile" on public.profiles
for insert with check ( id = auth.uid() );

create policy "update own username" on public.profiles
for update using ( id = auth.uid() ) with check ( id = auth.uid() );

create policy "admins manage profiles" on public.profiles
for all using ( public.is_admin() ) with check ( public.is_admin() );

-- 3) Core entities
create table if not exists public.items (
  id bigserial primary key,
  sku text not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.items enable row level security;

create table if not exists public.warehouses (
  id bigserial primary key,
  code text not null unique,
  name text not null default ''
);
alter table public.warehouses enable row level security;

create table if not exists public.racks (
  id bigserial primary key,
  warehouse_id bigint not null references public.warehouses(id) on delete cascade,
  code text not null,
  unique (warehouse_id, code)
);
alter table public.racks enable row level security;

create table if not exists public.item_locations (
  id bigserial primary key,
  item_id bigint not null references public.items(id) on delete cascade,
  warehouse_id bigint not null references public.warehouses(id) on delete restrict,
  rack_id bigint references public.racks(id) on delete set null,
  active boolean not null default true,
  note text not null default '',
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now()
);
alter table public.item_locations enable row level security;

create table if not exists public.print_logs (
  id bigserial primary key,
  user_id uuid references public.profiles(id),
  item_id bigint not null references public.items(id) on delete restrict,
  label_qty int not null check (label_qty > 0),
  label_size text not null,
  warehouse_id bigint not null references public.warehouses(id),
  rack_id bigint references public.racks(id),
  printed_at timestamptz not null default now()
);
alter table public.print_logs enable row level security;

-- 4) Defaults: auto-capture who is adding
create or replace function public.set_added_by() returns trigger language plpgsql as $$
begin
  if new.added_by is null then new.added_by := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists trg_set_added_by on public.item_locations;
create trigger trg_set_added_by before insert on public.item_locations
for each row execute function public.set_added_by();

create or replace function public.set_print_user() returns trigger language plpgsql as $$
begin
  if new.user_id is null then new.user_id := auth.uid(); end if;
  return new;
end;
$$;

drop trigger if exists trg_set_print_user on public.print_logs;
create trigger trg_set_print_user before insert on public.print_logs
for each row execute function public.set_print_user();

-- 5) RLS policies

-- Items: everyone authenticated can read; admins can insert/update
create policy "items select" on public.items for select using ( auth.role() = 'authenticated' );
create policy "items insert admin" on public.items for insert with check ( public.is_admin() );
create policy "items update admin" on public.items for update using ( public.is_admin() ) with check ( public.is_admin() );

-- Warehouses: read all; insert allowed so users can add new warehouse if needed; updates admin
create policy "warehouses select" on public.warehouses for select using ( auth.role() = 'authenticated' );
create policy "warehouses insert authenticated" on public.warehouses for insert with check ( auth.role() = 'authenticated' );
create policy "warehouses update admin" on public.warehouses for update using ( public.is_admin() ) with check ( public.is_admin() );

-- Racks: read all; insert allowed so users can add new rack; updates admin
create policy "racks select" on public.racks for select using ( auth.role() = 'authenticated' );
create policy "racks insert authenticated" on public.racks for insert with check ( auth.role() = 'authenticated' );
create policy "racks update admin" on public.racks for update using ( public.is_admin() ) with check ( public.is_admin() );

-- Item locations: read all; insert all; updates admin
create policy "item_locations select" on public.item_locations for select using ( auth.role() = 'authenticated' );
create policy "item_locations insert" on public.item_locations for insert with check ( auth.role() = 'authenticated' );
create policy "item_locations update admin" on public.item_locations for update using ( public.is_admin() ) with check ( public.is_admin() );

-- Print logs: only admins can select; anyone authenticated can insert
create policy "print_logs select admin" on public.print_logs for select using ( public.is_admin() );
create policy "print_logs insert" on public.print_logs for insert with check ( auth.role() = 'authenticated' );

-- 6) Report view (admin-only via guarded function)
create or replace view public.report_prints as
select
  pl.printed_at as date,
  pr.username,
  it.sku,
  pl.label_qty,
  pl.label_size,
  wh.code as warehouse_code,
  rk.code as rack_code
from public.print_logs pl
join public.items it on it.id = pl.item_id
left join public.warehouses wh on wh.id = pl.warehouse_id
left join public.racks rk on rk.id = pl.rack_id
left join public.profiles pr on pr.id = pl.user_id
order by pl.printed_at desc;

alter view public.report_prints owner to postgres;

create or replace function public.get_report_prints(start_date date default null, end_date date default null)
returns setof public.report_prints
language sql security definer
set search_path = public
as $$
  select *
  from public.report_prints
  where (start_date is null or date::date >= start_date)
    and (end_date is null or date::date <= end_date)
$$;

revoke all on function public.get_report_prints(date, date) from anon, authenticated;
grant execute on function public.get_report_prints(date, date) to authenticated;

create or replace function public.get_report_prints_guarded(start_date date default null, end_date date default null)
returns setof public.report_prints
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query select * from public.get_report_prints(start_date, end_date);
end;
$$;

revoke all on function public.get_report_prints_guarded(date, date) from anon, authenticated;
grant execute on function public.get_report_prints_guarded(date, date) to authenticated;

-- Check current user authentication
SELECT auth.uid() as current_user_id, auth.role() as current_role;

-- Helpful trigram indexes (enable extension first)
create extension if not exists pg_trgm;
create index if not exists idx_items_sku_trgm on public.items using gin (sku gin_trgm_ops);
create index if not exists idx_items_name_trgm on public.items using gin (name gin_trgm_ops);

-- DONE