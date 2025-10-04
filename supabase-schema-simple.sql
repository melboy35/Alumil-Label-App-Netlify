-- Simple Schema for Single-Tenant Setup (No org_id)
-- Use this if you get "column org_id does not exist" error

-- Profiles table (simple version)
create table if not exists profiles (
  code text primary key,
  description text,
  length numeric,
  color text,
  updated_at timestamptz not null default now()
);

-- Accessories table (simple version)  
create table if not exists accessories (
  code text primary key,
  description text,
  unit text,
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security (optional for single-tenant)
alter table profiles enable row level security;
alter table accessories enable row level security;

-- Simple RLS policies (allow all authenticated users)
create policy "allow all profiles" on profiles for all using (auth.role() = 'authenticated');
create policy "allow all accessories" on accessories for all using (auth.role() = 'authenticated');