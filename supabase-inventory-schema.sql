-- SUPABASE INVENTORY MANAGEMENT SCHEMA
-- Excel ingestion with admin controls and live sync

-- 1) Profiles with admin flag
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Anyone can read their own profile
create policy "read own profile"
on public.profiles for select
using (auth.uid() = id);

-- Helper: auto-create profile row after signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 2) Inventory items table (matching Excel structure)
create table if not exists public.inventory_items (
  sku text primary key,
  name text not null,
  category text,
  qty numeric not null default 0,
  cost numeric,
  price numeric,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists idx_inventory_category on public.inventory_items(category);
create index if not exists idx_inventory_updated_at on public.inventory_items(updated_at);
create index if not exists idx_inventory_active on public.inventory_items(is_active);

alter table public.inventory_items enable row level security;

-- RLS: anyone authenticated can read
create policy "read inventory for authenticated"
on public.inventory_items for select
using (auth.role() = 'authenticated');

-- Only admins can write
create policy "admin insert inventory"
on public.inventory_items for insert
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admin update inventory"
on public.inventory_items for update
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admin delete inventory"
on public.inventory_items for delete
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- 3) Helper function for reconciliation (mark missing items as inactive)
create or replace function public.deactivate_missing_inventory(p_skus text[])
returns void language sql as $$
  update public.inventory_items
     set is_active = false, updated_at = now()
   where sku not = any(p_skus)
$$;

-- 4) Storage policies for inventory bucket
-- Note: Create bucket 'inventory' in Supabase Storage first

-- Read policy (optional - for exposing raw files to users)
create policy "read inventory bucket for auth"
on storage.objects for select
using (bucket_id = 'inventory' and auth.role() = 'authenticated');

-- Admin write policy
create policy "admin write inventory bucket"
on storage.objects for all
using (
  bucket_id = 'inventory'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
)
with check (
  bucket_id = 'inventory'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

-- 5) Views for common queries
create or replace view public.active_inventory as
select sku, name, category, qty, cost, price, updated_at
from public.inventory_items
where is_active = true
order by name;

create or replace view public.low_stock_items as
select sku, name, category, qty, cost, price
from public.inventory_items
where is_active = true and qty < 5
order by qty, name;

-- 6) Admin helper functions
create or replace function public.is_admin_user()
returns boolean language sql stable as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

-- Function to make current user admin (run once after signup)
create or replace function public.make_me_admin()
returns void language sql security definer as $$
  update public.profiles set is_admin = true where id = auth.uid();
$$;

-- 7) Inventory search function with filters
create or replace function public.search_inventory(
  search_term text default null,
  category_filter text default null,
  active_only boolean default true
)
returns setof public.inventory_items
language sql stable as $$
  select *
  from public.inventory_items
  where 
    (not active_only or is_active = true)
    and (search_term is null or 
         sku ilike '%' || search_term || '%' or 
         name ilike '%' || search_term || '%')
    and (category_filter is null or category = category_filter)
  order by name;
$$;

-- 8) Category listing function
create or replace function public.get_categories()
returns table(category text, item_count bigint)
language sql stable as $$
  select category, count(*)
  from public.inventory_items
  where is_active = true and category is not null
  group by category
  order by category;
$$;

-- SETUP INSTRUCTIONS:
-- 1. Run this schema in Supabase SQL Editor
-- 2. Create storage bucket named 'inventory' (private)
-- 3. Deploy the Edge Function (see supabase-ingest-function.ts)
-- 4. Set admin secret: supabase secrets set ADMIN_INGEST_SECRET="your-secret"
-- 5. Make your account admin: SELECT public.make_me_admin();

-- DONE