-- Extensions
create extension if not exists "pgcrypto";

-- Core tables
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'operator', 'technician')),
  created_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude numeric not null,
  longitude numeric not null,
  tower_height integer not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text not null,
  firmware_version text not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null check (status in ('online', 'offline', 'warning', 'maintenance')),
  temperature numeric not null default 25,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  source_site_id uuid not null references public.sites(id) on delete cascade,
  destination_site_id uuid not null references public.sites(id) on delete cascade,
  capacity_mbps integer not null,
  utilization_percent numeric not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  speed_limit integer not null,
  monthly_price numeric not null,
  bandwidth_cap integer not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  service_plan_id uuid not null references public.service_plans(id) on delete restrict,
  status text not null check (status in ('active', 'suspended', 'pending')),
  connection_site uuid not null references public.sites(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (email, organization_id)
);

create table if not exists public.performance_metrics (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  throughput numeric not null,
  latency numeric not null,
  packet_loss numeric not null,
  signal_strength numeric not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.alarms (
  id uuid primary key default gen_random_uuid(),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  message text not null,
  equipment_id uuid references public.equipment(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_sites_org on public.sites (organization_id);
create index if not exists idx_equipment_org on public.equipment (organization_id);
create index if not exists idx_equipment_site on public.equipment (site_id);
create index if not exists idx_subscribers_org on public.subscribers (organization_id);
create index if not exists idx_performance_metrics_org on public.performance_metrics (organization_id);
create index if not exists idx_performance_metrics_eq_recorded on public.performance_metrics (equipment_id, recorded_at desc);
create index if not exists idx_alarms_org_resolved on public.alarms (organization_id, resolved);

-- Helpers
create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id
  from public.users
  where id = auth.uid()
  limit 1;
$$;

create or replace function public.set_org_id()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.current_user_org_id();
  end if;
  return new;
end;
$$;

create or replace function public.ensure_org_and_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  user_role text;
  user_name text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'operator');
  user_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  insert into public.organizations (name)
  values (user_name || ' Network')
  returning id into org_id;

  insert into public.users (id, organization_id, full_name, role)
  values (new.id, org_id, user_name, user_role);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.ensure_org_and_profile();

-- Alarm generators
create or replace function public.create_alarm_if_needed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eq public.equipment;
begin
  select * into eq from public.equipment where id = new.equipment_id;

  if new.latency > 80 then
    insert into public.alarms (severity, message, equipment_id, site_id, organization_id)
    values ('high', 'High latency detected (' || new.latency || ' ms)', eq.id, eq.site_id, new.organization_id);
  end if;

  if eq.temperature > 70 then
    insert into public.alarms (severity, message, equipment_id, site_id, organization_id)
    values ('critical', 'Equipment overheating (' || eq.temperature || ' C)', eq.id, eq.site_id, new.organization_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_metric_alarm on public.performance_metrics;
create trigger trg_metric_alarm
after insert on public.performance_metrics
for each row execute function public.create_alarm_if_needed();

create or replace function public.create_offline_alarm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'offline' and old.status is distinct from new.status then
    insert into public.alarms (severity, message, equipment_id, site_id, organization_id)
    values ('critical', 'Device offline: ' || new.name, new.id, new.site_id, new.organization_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_equipment_offline_alarm on public.equipment;
create trigger trg_equipment_offline_alarm
after update on public.equipment
for each row execute function public.create_offline_alarm();

drop trigger if exists trg_sites_org on public.sites;
create trigger trg_sites_org
before insert on public.sites
for each row execute function public.set_org_id();

drop trigger if exists trg_equipment_org on public.equipment;
create trigger trg_equipment_org
before insert on public.equipment
for each row execute function public.set_org_id();

drop trigger if exists trg_links_org on public.links;
create trigger trg_links_org
before insert on public.links
for each row execute function public.set_org_id();

drop trigger if exists trg_service_plans_org on public.service_plans;
create trigger trg_service_plans_org
before insert on public.service_plans
for each row execute function public.set_org_id();

drop trigger if exists trg_subscribers_org on public.subscribers;
create trigger trg_subscribers_org
before insert on public.subscribers
for each row execute function public.set_org_id();

drop trigger if exists trg_performance_metrics_org on public.performance_metrics;
create trigger trg_performance_metrics_org
before insert on public.performance_metrics
for each row execute function public.set_org_id();

drop trigger if exists trg_alarms_org on public.alarms;
create trigger trg_alarms_org
before insert on public.alarms
for each row execute function public.set_org_id();

-- RLS
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.sites enable row level security;
alter table public.equipment enable row level security;
alter table public.links enable row level security;
alter table public.service_plans enable row level security;
alter table public.subscribers enable row level security;
alter table public.performance_metrics enable row level security;
alter table public.alarms enable row level security;

-- Drop existing policies safely
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(array['organizations','users','sites','equipment','links','service_plans','subscribers','performance_metrics','alarms'])
  LOOP
    EXECUTE format('drop policy if exists "%s_select" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_insert" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_update" on public.%I', t, t);
    EXECUTE format('drop policy if exists "%s_delete" on public.%I', t, t);
  END LOOP;
END
$$;

create policy "organizations_select" on public.organizations
for select using (id = public.current_user_org_id());

create policy "organizations_update" on public.organizations
for update using (id = public.current_user_org_id()) with check (id = public.current_user_org_id());

create policy "users_select" on public.users
for select using (organization_id = public.current_user_org_id());

create policy "users_update" on public.users
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());

create policy "users_insert" on public.users
for insert with check (id = auth.uid() and organization_id = public.current_user_org_id());

create policy "sites_select" on public.sites
for select using (organization_id = public.current_user_org_id());
create policy "sites_insert" on public.sites
for insert with check (organization_id = public.current_user_org_id());
create policy "sites_update" on public.sites
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "sites_delete" on public.sites
for delete using (organization_id = public.current_user_org_id());

create policy "equipment_select" on public.equipment
for select using (organization_id = public.current_user_org_id());
create policy "equipment_insert" on public.equipment
for insert with check (organization_id = public.current_user_org_id());
create policy "equipment_update" on public.equipment
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "equipment_delete" on public.equipment
for delete using (organization_id = public.current_user_org_id());

create policy "links_select" on public.links
for select using (organization_id = public.current_user_org_id());
create policy "links_insert" on public.links
for insert with check (organization_id = public.current_user_org_id());
create policy "links_update" on public.links
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "links_delete" on public.links
for delete using (organization_id = public.current_user_org_id());

create policy "service_plans_select" on public.service_plans
for select using (organization_id = public.current_user_org_id());
create policy "service_plans_insert" on public.service_plans
for insert with check (organization_id = public.current_user_org_id());
create policy "service_plans_update" on public.service_plans
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "service_plans_delete" on public.service_plans
for delete using (organization_id = public.current_user_org_id());

create policy "subscribers_select" on public.subscribers
for select using (organization_id = public.current_user_org_id());
create policy "subscribers_insert" on public.subscribers
for insert with check (organization_id = public.current_user_org_id());
create policy "subscribers_update" on public.subscribers
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "subscribers_delete" on public.subscribers
for delete using (organization_id = public.current_user_org_id());

create policy "performance_metrics_select" on public.performance_metrics
for select using (organization_id = public.current_user_org_id());
create policy "performance_metrics_insert" on public.performance_metrics
for insert with check (organization_id = public.current_user_org_id());
create policy "performance_metrics_update" on public.performance_metrics
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "performance_metrics_delete" on public.performance_metrics
for delete using (organization_id = public.current_user_org_id());

create policy "alarms_select" on public.alarms
for select using (organization_id = public.current_user_org_id());
create policy "alarms_insert" on public.alarms
for insert with check (organization_id = public.current_user_org_id());
create policy "alarms_update" on public.alarms
for update using (organization_id = public.current_user_org_id()) with check (organization_id = public.current_user_org_id());
create policy "alarms_delete" on public.alarms
for delete using (organization_id = public.current_user_org_id());
