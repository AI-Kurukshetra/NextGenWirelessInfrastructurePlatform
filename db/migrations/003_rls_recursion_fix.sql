-- Fix RLS recursion on public.users by avoiding self-referential policies
-- and making helper functions bypass RLS explicitly.

begin;

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select organization_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select role
  from public.users
  where id = auth.uid()
  limit 1;
$$;

alter function public.current_user_org_id() owner to postgres;
alter function public.current_user_role() owner to postgres;

grant execute on function public.current_user_org_id() to anon, authenticated, service_role;
grant execute on function public.current_user_role() to anon, authenticated, service_role;

-- Replace recursive users policies with self-only policies.
drop policy if exists users_select on public.users;
drop policy if exists users_insert on public.users;
drop policy if exists users_update on public.users;

drop policy if exists "users_select" on public.users;
drop policy if exists "users_insert" on public.users;
drop policy if exists "users_update" on public.users;

create policy users_select on public.users
for select
using (id = auth.uid());

create policy users_insert on public.users
for insert
with check (id = auth.uid());

create policy users_update on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());

commit;
