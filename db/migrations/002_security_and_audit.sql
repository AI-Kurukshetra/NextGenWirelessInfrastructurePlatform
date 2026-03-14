-- Role helpers
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.users
  where id = auth.uid()
  limit 1;
$$;

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_org_created on public.audit_logs (organization_id, created_at desc);
create index if not exists idx_audit_logs_user_created on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

drop trigger if exists trg_audit_logs_org on public.audit_logs;
create trigger trg_audit_logs_org
before insert on public.audit_logs
for each row execute function public.set_org_id();

-- Audit log policies
DO $$
BEGIN
  execute 'drop policy if exists "audit_logs_select" on public.audit_logs';
  execute 'drop policy if exists "audit_logs_insert" on public.audit_logs';
END
$$;

create policy "audit_logs_select" on public.audit_logs
for select using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "audit_logs_insert" on public.audit_logs
for insert with check (
  organization_id = public.current_user_org_id()
  and auth.uid() is not null
);

-- Strengthen role-based write permissions
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(array['sites','equipment','links','service_plans','subscribers','performance_metrics','alarms'])
  LOOP
    EXECUTE format('drop policy if exists "%s_insert" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_update" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_delete" on public.%I', t, t);
  END LOOP;

  execute 'drop policy if exists "organizations_update" on public.organizations';
  execute 'drop policy if exists "users_update" on public.users';
END
$$;

-- Admin/operator CRUD on most operational tables.
create policy "sites_insert" on public.sites
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "sites_update" on public.sites
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "sites_delete" on public.sites
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "equipment_insert" on public.equipment
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "equipment_update" on public.equipment
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator', 'technician')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator', 'technician')
);
create policy "equipment_delete" on public.equipment
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "links_insert" on public.links
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "links_update" on public.links
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "links_delete" on public.links
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "service_plans_insert" on public.service_plans
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "service_plans_update" on public.service_plans
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "service_plans_delete" on public.service_plans
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "subscribers_insert" on public.subscribers
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "subscribers_update" on public.subscribers
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "subscribers_delete" on public.subscribers
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "performance_metrics_insert" on public.performance_metrics
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator', 'technician')
);
create policy "performance_metrics_update" on public.performance_metrics
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "performance_metrics_delete" on public.performance_metrics
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy "alarms_insert" on public.alarms
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator', 'technician')
);
create policy "alarms_update" on public.alarms
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);
create policy "alarms_delete" on public.alarms
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

-- Admin-only org/profile mutation
create policy "organizations_update" on public.organizations
for update using (
  id = public.current_user_org_id()
  and public.current_user_role() = 'admin'
)
with check (
  id = public.current_user_org_id()
  and public.current_user_role() = 'admin'
);

create policy "users_update" on public.users
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() = 'admin'
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() = 'admin'
);
