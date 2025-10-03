-- Supabase Schema for Alumil Inventory System
-- Run this SQL once in your Supabase project (SQL editor)

-- Organizations (optional if single-tenant; keep for future)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Profiles
create table if not exists profiles (
  org_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  description text,
  length numeric,
  color text,
  -- add any other columns you need…
  updated_at timestamptz not null default now(),
  primary key (org_id, code)
);

-- Accessories
create table if not exists accessories (
  org_id uuid not null references organizations(id) on delete cascade,
  code text not null,
  description text,
  unit text,
  -- add columns as needed…
  updated_at timestamptz not null default now(),
  primary key (org_id, code)
);

-- Dataset versions (to show "last updated", counts, etc.)
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

-- RLS policies (adjust for your auth model; here we allow read to all authenticated users of the same org)
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

-- Insert default organization for single-tenant setup
insert into organizations (id, name) values 
  ('00000000-0000-0000-0000-000000000000', 'Alumil Default Organization')
on conflict (id) do nothing;