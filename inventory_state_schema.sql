-- Inventory State Schema
-- This schema adds the inventory_state table to track Excel file versions

-- Create inventory_state table (one row per organization)
create table if not exists public.inventory_state (
  organization_id uuid primary key references public.organizations(id),
  storage_path text not null,      -- e.g. 'org_abc/1696153210000_master.xlsx'
  version int not null default 1,  -- bump on every new upload
  invalidate_at timestamptz,       -- set when admin clicks "Clear cache"
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

-- Enable row level security
alter table public.inventory_state enable row level security;

-- Create RLS policies
-- Any authenticated user can read inventory_state
create policy "authenticated users can read" on public.inventory_state
for select using (
  auth.role() = 'authenticated'
);

-- Only admins can update
create policy "admins can update" on public.inventory_state
for update using (
  auth.role() = 'authenticated' AND 
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Only admins can insert
create policy "admins can insert" on public.inventory_state
for insert with check (
  auth.role() = 'authenticated' AND 
  exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
);

-- Create RPC function for version bump
create or replace function public.bump_inventory_version(org uuid, path text)
returns void language sql security definer as $$
  insert into public.inventory_state(organization_id, storage_path, version, updated_by)
  values (org, path, 1, auth.uid())
  on conflict (organization_id)
  do update set storage_path = excluded.storage_path,
                version = public.inventory_state.version + 1,
                invalidate_at = null,
                updated_at = now(),
                updated_by = excluded.updated_by;
$$;

-- Insert default row for default organization
INSERT INTO public.inventory_state (organization_id, storage_path, version) 
VALUES ('00000000-0000-0000-0000-000000000000', '', 1)
ON CONFLICT (organization_id) DO NOTHING;

-- Add index
CREATE INDEX IF NOT EXISTS idx_inventory_state_org ON public.inventory_state(organization_id);