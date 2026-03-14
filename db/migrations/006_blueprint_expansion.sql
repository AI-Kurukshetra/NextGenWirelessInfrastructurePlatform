begin;

-- Missing key entities from blueprint data model
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  site_id uuid references public.sites(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  subscriber_id uuid references public.subscribers(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  resolved_at timestamptz,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'radio',
  vendor text,
  model text,
  serial_number text,
  quantity integer not null default 1,
  status text not null default 'in_stock' check (status in ('in_stock', 'allocated', 'maintenance', 'retired')),
  site_id uuid references public.sites(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  equipment_id uuid references public.equipment(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  scheduled_at timestamptz,
  completed_at timestamptz,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  invoice_number text not null,
  amount numeric not null,
  currency text not null default 'USD',
  due_date date not null,
  paid_at timestamptz,
  status text not null default 'due' check (status in ('due', 'paid', 'overdue', 'void')),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

-- Coverage planning/GIS depth
create table if not exists public.rf_propagation_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_id uuid not null references public.sites(id) on delete cascade,
  frequency_mhz numeric not null,
  tx_power_dbm numeric not null,
  antenna_height_m numeric not null,
  predicted_radius_km numeric not null,
  notes text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.coverage_measurements (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete set null,
  latitude numeric not null,
  longitude numeric not null,
  signal_strength numeric not null,
  noise_floor numeric,
  sinr numeric,
  collected_at timestamptz not null default now(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Advanced / differentiating feature framework (simulation-oriented)
create table if not exists public.advanced_feature_profiles (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null check (feature_key in (
    'ai_network_optimization',
    'dynamic_spectrum_access',
    'edge_computing_integration',
    'fwa_5g_integration',
    'self_healing_networks',
    'blockchain_authentication',
    'weather_adaptive_performance',
    'multi_tenant_network_slicing',
    'predictive_maintenance',
    'zero_touch_provisioning',
    'software_defined_radio',
    'digital_twin_modeling',
    'container_network_functions'
  )),
  name text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, feature_key)
);

create table if not exists public.advanced_feature_runs (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_tickets_org_status on public.tickets (organization_id, status, priority);
create index if not exists idx_inventory_org_status on public.inventory_items (organization_id, status, category);
create index if not exists idx_maintenance_org_status on public.maintenance_tasks (organization_id, status, scheduled_at);
create index if not exists idx_billing_org_status_due on public.billing_records (organization_id, status, due_date);
create index if not exists idx_cov_meas_org_collected on public.coverage_measurements (organization_id, collected_at desc);
create index if not exists idx_advanced_runs_org_feature on public.advanced_feature_runs (organization_id, feature_key, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_tickets_updated_at on public.tickets;
create trigger trg_tickets_updated_at before update on public.tickets
for each row execute function public.touch_updated_at();

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at before update on public.inventory_items
for each row execute function public.touch_updated_at();

drop trigger if exists trg_maintenance_tasks_updated_at on public.maintenance_tasks;
create trigger trg_maintenance_tasks_updated_at before update on public.maintenance_tasks
for each row execute function public.touch_updated_at();

drop trigger if exists trg_advanced_feature_profiles_updated_at on public.advanced_feature_profiles;
create trigger trg_advanced_feature_profiles_updated_at before update on public.advanced_feature_profiles
for each row execute function public.touch_updated_at();

-- Org auto-assignment triggers
select public.attach_org_trigger('tickets');
select public.attach_org_trigger('inventory_items');
select public.attach_org_trigger('maintenance_tasks');
select public.attach_org_trigger('billing_records');
select public.attach_org_trigger('rf_propagation_models');
select public.attach_org_trigger('coverage_measurements');
select public.attach_org_trigger('advanced_feature_profiles');
select public.attach_org_trigger('advanced_feature_runs');

-- RLS + standard policies
alter table public.tickets enable row level security;
alter table public.inventory_items enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.billing_records enable row level security;
alter table public.rf_propagation_models enable row level security;
alter table public.coverage_measurements enable row level security;
alter table public.advanced_feature_profiles enable row level security;
alter table public.advanced_feature_runs enable row level security;

select public.create_standard_org_policies('tickets');
select public.create_standard_org_policies('inventory_items');
select public.create_standard_org_policies('maintenance_tasks');
select public.create_standard_org_policies('billing_records');
select public.create_standard_org_policies('rf_propagation_models');
select public.create_standard_org_policies('coverage_measurements');
select public.create_standard_org_policies('advanced_feature_profiles');
select public.create_standard_org_policies('advanced_feature_runs');

-- Seed default advanced feature profiles for each org when missing
insert into public.advanced_feature_profiles (feature_key, name, enabled, config, organization_id)
select k.feature_key, k.name, false, '{}'::jsonb, o.id
from public.organizations o
cross join (
  values
    ('ai_network_optimization', 'AI-Powered Network Optimization'),
    ('dynamic_spectrum_access', 'Dynamic Spectrum Access'),
    ('edge_computing_integration', 'Edge Computing Integration'),
    ('fwa_5g_integration', '5G Fixed Wireless Access'),
    ('self_healing_networks', 'Self-Healing Networks'),
    ('blockchain_authentication', 'Blockchain-Based Authentication'),
    ('weather_adaptive_performance', 'Weather-Adaptive Performance'),
    ('multi_tenant_network_slicing', 'Multi-Tenant Network Slicing'),
    ('predictive_maintenance', 'Predictive Maintenance'),
    ('zero_touch_provisioning', 'Zero-Touch Provisioning'),
    ('software_defined_radio', 'Software-Defined Radio'),
    ('digital_twin_modeling', 'Digital Twin Network Modeling'),
    ('container_network_functions', 'Container-Based Network Functions')
) as k(feature_key, name)
on conflict (organization_id, feature_key) do nothing;

commit;
