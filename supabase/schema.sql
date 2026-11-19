-- M2proj schema. Run ONCE in the SQL editor of a fresh Supabase project.

-- Roles come from app_metadata.m2proj_role on the two accounts (see supabase/roles.sql).
create or replace function public.m2_role() returns text
language sql stable
as $$ select coalesce(auth.jwt() -> 'app_metadata' ->> 'm2proj_role', '') $$;

create or replace function public.is_member() returns boolean
language sql stable
as $$ select public.m2_role() in ('team', 'admin') $$;

create or replace function public.is_admin() returns boolean
language sql stable
as $$ select public.m2_role() = 'admin' $$;

-- Keep-alive endpoint for the scheduled GitHub Action. Returns no data.
create or replace function public.ping() returns integer
language sql stable
as $$ select 1 $$;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  position integer not null default 0
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  deadline date,
  status text not null default 'waiting' check (status in ('waiting', 'taken', 'finished')),
  taken_by uuid references public.members (id),
  created_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint tasks_owner_matches_status check ((status = 'waiting') = (taken_by is null)),
  constraint tasks_finished_at_matches_status check ((status = 'finished') = (finished_at is not null))
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete restrict,
  kind text not null check (kind in ('file', 'link')),
  title text not null check (length(trim(title)) > 0),
  url text check (url ~* '^https?://'),
  storage_path text,
  size_bytes bigint check (size_bytes >= 0),
  added_by uuid not null references public.members (id),
  created_at timestamptz not null default now(),
  constraint items_kind_fields check (
    (kind = 'link' and url is not null and storage_path is null and size_bytes is null)
    or (kind = 'file' and storage_path is not null and url is null and size_bytes is not null)
  )
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
as $$ begin new.updated_at = now(); return new; end $$;

create trigger tasks_touch_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

-- Privileges: nothing for anonymous visitors; RLS decides for logged-in users.
revoke all on public.members, public.categories, public.tasks, public.items from anon;
grant select, insert, update, delete on public.members, public.categories, public.tasks, public.items to authenticated;
grant execute on function public.ping() to anon, authenticated;

alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.items enable row level security;

-- members: everyone reads, admin writes, nobody deletes (hide instead)
create policy members_select on public.members for select to authenticated using (public.is_member());
create policy members_insert on public.members for insert to authenticated with check (public.is_admin());
create policy members_update on public.members for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- categories: everyone reads, admin writes and deletes
create policy categories_select on public.categories for select to authenticated using (public.is_member());
create policy categories_insert on public.categories for insert to authenticated with check (public.is_admin());
create policy categories_update on public.categories for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_delete on public.categories for delete to authenticated using (public.is_admin());

-- tasks: everyone reads/adds/edits, admin deletes
create policy tasks_select on public.tasks for select to authenticated using (public.is_member());
create policy tasks_insert on public.tasks for insert to authenticated with check (public.is_member());
create policy tasks_update on public.tasks for update to authenticated using (public.is_member()) with check (public.is_member());
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_admin());

-- items: same as tasks
create policy items_select on public.items for select to authenticated using (public.is_member());
create policy items_insert on public.items for insert to authenticated with check (public.is_member());
create policy items_update on public.items for update to authenticated using (public.is_member()) with check (public.is_member());
create policy items_delete on public.items for delete to authenticated using (public.is_admin());

-- Storage: private bucket, 50 MB per file
insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "m2proj files select" on storage.objects for select to authenticated
  using (bucket_id = 'files' and public.is_member());
create policy "m2proj files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and public.is_member());
create policy "m2proj files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'files' and public.is_admin());
