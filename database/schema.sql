-- SIMPLIFIED SUPABASE SCHEMA FOR DIRECT EXCEL READING
-- Option B1: Store Excel file in Supabase Storage, read directly on client

-- 1) Profiles with admin flag (minimal)
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

-- 2) File metadata tracking (optional but useful for cache-busting)
create table if not exists public.inventory_files (
  id bigserial primary key,
  filename text not null default 'inventory.xlsx',
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  file_size bigint,
  checksum text,
  is_current boolean not null default false
);
alter table public.inventory_files enable row level security;

-- Anyone authenticated can read file metadata
create policy "read file metadata"
on public.inventory_files for select
using (auth.role() = 'authenticated');

-- Only admins can manage files
create policy "admin manage files"
on public.inventory_files for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Function to mark a file as current
create or replace function public.set_current_file(file_id bigint)
returns void language sql security definer as $$
  -- First, mark all files as not current
  update public.inventory_files set is_current = false;
  -- Then mark the specified file as current
  update public.inventory_files set is_current = true where id = file_id;
$$;

-- 3) Storage policies for inventory bucket
-- Create bucket 'inventory' in Supabase Storage (PUBLIC for direct client access)

-- Anyone authenticated can read files (for direct Excel download)
create policy "read inventory files for authenticated"
on storage.objects for select
using (bucket_id = 'inventory' and auth.role() = 'authenticated');

-- Only admins can upload/manage files
create policy "admin manage inventory files"
on storage.objects for all
using (
  bucket_id = 'inventory'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
)
with check (
  bucket_id = 'inventory'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
);

-- 4) Helper functions
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

-- Get current file info for cache-busting
create or replace function public.get_current_file_info()
returns table(filename text, uploaded_at timestamptz, checksum text)
language sql stable as $$
  select filename, uploaded_at, checksum
  from public.inventory_files
  where is_current = true
  order by uploaded_at desc
  limit 1;
$$;

-- Admin function to insert file metadata and mark as current (SECURITY DEFINER)
create or replace function public.insert_inventory_file_and_mark_current(
  p_filename text,
  p_uploaded_by uuid,
  p_file_size bigint,
  p_checksum text
)
returns json
language plpgsql security definer as $$
declare
  new_record_id bigint;
  result json;
begin
  -- Check if user is admin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Only admins can upload files';
  end if;

  -- Mark all existing files as not current
  update public.inventory_files set is_current = false;

  -- Insert new file record
  insert into public.inventory_files (
    filename, uploaded_by, file_size, checksum, is_current
  ) values (
    p_filename, p_uploaded_by, p_file_size, p_checksum, true
  ) returning id into new_record_id;

  -- Return success info
  select json_build_object(
    'success', true,
    'file_id', new_record_id,
    'filename', p_filename,
    'checksum', p_checksum,
    'uploaded_at', now()
  ) into result;

  return result;
end;
$$;

-- Revoke execute from public, grant only to authenticated users (admin check is inside function)
revoke execute on function public.insert_inventory_file_and_mark_current(text, uuid, bigint, text) from public;
grant execute on function public.insert_inventory_file_and_mark_current(text, uuid, bigint, text) to authenticated;

-- SETUP INSTRUCTIONS:
-- 1. Run this schema in Supabase SQL Editor
-- 2. Create storage bucket named 'inventory' (PUBLIC for direct client access)
-- 3. Make your account admin: SELECT public.make_me_admin();
-- 4. Upload Excel file using admin interface
-- 5. Use client-side Excel parsing library (see inventory-direct-reader.js)

-- BENEFITS:
-- ✅ Simple infrastructure (no Edge Functions)
-- ✅ Keep Excel format intact
-- ✅ Fast setup and deployment
-- ✅ Direct file access from clients
-- ✅ Built-in cache-busting with metadata

-- CONSIDERATIONS:
-- ⚠️ Excel parsing happens on client (load time depends on file size)
-- ⚠️ All clients download full file (consider mobile data usage)
-- ⚠️ Suitable for files up to ~5-10MB for good performance

-- DONE