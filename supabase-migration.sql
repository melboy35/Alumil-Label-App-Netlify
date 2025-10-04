-- Migration Script: Add org_id column to existing tables
-- Run this if you get "column org_id does not exist" error

-- First, create organizations table if it doesn't exist
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Insert default organization
insert into organizations (id, name) values 
  ('00000000-0000-0000-0000-000000000000', 'Alumil Default Organization')
on conflict (id) do nothing;

-- Check if profiles table exists and add org_id column if missing
do $$
begin
  -- Add org_id column to profiles if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                where table_name = 'profiles' and column_name = 'org_id') then
    alter table profiles add column org_id uuid;
    
    -- Set default org_id for existing rows
    update profiles set org_id = '00000000-0000-0000-0000-000000000000' 
    where org_id is null;
    
    -- Make org_id not null and add foreign key
    alter table profiles alter column org_id set not null;
    alter table profiles add constraint profiles_org_id_fkey 
      foreign key (org_id) references organizations(id) on delete cascade;
    
    -- Drop existing primary key if it exists and create composite primary key
    alter table profiles drop constraint if exists profiles_pkey;
    alter table profiles add primary key (org_id, code);
  end if;
  
  -- Add updated_at column if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                where table_name = 'profiles' and column_name = 'updated_at') then
    alter table profiles add column updated_at timestamptz not null default now();
  end if;
end
$$;

-- Check if accessories table exists and add org_id column if missing
do $$
begin
  -- Add org_id column to accessories if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                where table_name = 'accessories' and column_name = 'org_id') then
    alter table accessories add column org_id uuid;
    
    -- Set default org_id for existing rows
    update accessories set org_id = '00000000-0000-0000-0000-000000000000' 
    where org_id is null;
    
    -- Make org_id not null and add foreign key
    alter table accessories alter column org_id set not null;
    alter table accessories add constraint accessories_org_id_fkey 
      foreign key (org_id) references organizations(id) on delete cascade;
    
    -- Drop existing primary key if it exists and create composite primary key
    alter table accessories drop constraint if exists accessories_pkey;
    alter table accessories add primary key (org_id, code);
  end if;
  
  -- Add updated_at column if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                where table_name = 'accessories' and column_name = 'updated_at') then
    alter table accessories add column updated_at timestamptz not null default now();
  end if;
end
$$;

-- Create dataset_versions table if it doesn't exist
create table if not exists dataset_versions (
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null check (kind in ('profiles','accessories')),
  version bigint not null,
  row_count int not null,
  created_at timestamptz not null default now(),
  primary key (org_id, kind, version)
);

-- Enable Row Level Security
alter table profiles enable row level security;
alter table accessories enable row level security;
alter table dataset_versions enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "read same org profiles" on profiles;
drop policy if exists "upsert same org profiles" on profiles;
drop policy if exists "update same org profiles" on profiles;
drop policy if exists "read same org accessories" on accessories;
drop policy if exists "upsert same org accessories" on accessories;
drop policy if exists "update same org accessories" on accessories;
drop policy if exists "read versions" on dataset_versions;
drop policy if exists "write versions" on dataset_versions;

-- Create RLS policies
create policy "read same org profiles"
on profiles for select
using (auth.jwt() ->> 'org_id' = org_id::text);

create policy "upsert same org profiles"
on profiles for insert with check (auth.jwt() ->> 'org_id' = org_id::text);

create policy "update same org profiles"
on profiles for update using (auth.jwt() ->> 'org_id' = org_id::text);

create policy "read same org accessories"
on accessories for select
using (auth.jwt() ->> 'org_id' = org_id::text);

create policy "upsert same org accessories"
on accessories for insert with check (auth.jwt() ->> 'org_id' = org_id::text);

create policy "update same org accessories"
on accessories for update using (auth.jwt() ->> 'org_id' = org_id::text);

create policy "read versions"
on dataset_versions for select
using (auth.jwt() ->> 'org_id' = org_id::text);

create policy "write versions"
on dataset_versions for insert with check (auth.jwt() ->> 'org_id' = org_id::text);