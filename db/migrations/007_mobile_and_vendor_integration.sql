begin;

alter table public.equipment
  add column if not exists vendor text,
  add column if not exists management_ip text,
  add column if not exists provisioning_state text default 'unprovisioned' check (provisioning_state in ('unprovisioned', 'provisioning', 'provisioned', 'failed'));

update public.equipment
set vendor = case
  when lower(model) like '%cambium%' or lower(model) like '%epmp%' then 'cambium'
  when lower(model) like '%mikrotik%' then 'mikrotik'
  else coalesce(vendor, 'generic')
end
where vendor is null;

create table if not exists public.vendor_device_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vendor text not null check (vendor in ('cambium', 'mikrotik', 'generic')),
  model_pattern text,
  transport text not null default 'https' check (transport in ('https', 'snmp', 'ssh', 'api')),
  config_template jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  profile_id uuid references public.vendor_device_profiles(id) on delete set null,
  vendor text not null,
  mode text not null default 'provision' check (mode in ('provision', 'backup', 'firmware', 'diagnostic')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb,
  error_message text,
  initiated_by uuid references auth.users(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists idx_equipment_vendor_state on public.equipment (organization_id, vendor, provisioning_state);
create index if not exists idx_vendor_profiles_org_vendor on public.vendor_device_profiles (organization_id, vendor, enabled);
create index if not exists idx_provisioning_jobs_org_status on public.provisioning_jobs (organization_id, status, created_at desc);

create or replace function public.touch_updated_at_vendor()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_vendor_device_profiles_updated_at on public.vendor_device_profiles;
create trigger trg_vendor_device_profiles_updated_at
before update on public.vendor_device_profiles
for each row execute function public.touch_updated_at_vendor();

select public.attach_org_trigger('vendor_device_profiles');
select public.attach_org_trigger('provisioning_jobs');

alter table public.vendor_device_profiles enable row level security;
alter table public.provisioning_jobs enable row level security;

select public.create_standard_org_policies('vendor_device_profiles');
select public.create_standard_org_policies('provisioning_jobs');

commit;
