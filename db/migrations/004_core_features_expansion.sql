begin;

-- 1) Extend subscribers for bandwidth throttling enforcement
alter table public.subscribers
  add column if not exists enforced_speed_limit integer;

create or replace function public.apply_subscriber_speed_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_speed integer;
begin
  select speed_limit into plan_speed
  from public.service_plans
  where id = new.service_plan_id;

  new.enforced_speed_limit := coalesce(plan_speed, 0);
  return new;
end;
$$;

drop trigger if exists trg_subscriber_speed_limit on public.subscribers;
create trigger trg_subscriber_speed_limit
before insert or update of service_plan_id on public.subscribers
for each row execute function public.apply_subscriber_speed_limit();

-- 2) New entities for missing core features
create table if not exists public.networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  topology text not null check (topology in ('p2p', 'ptmp', 'mesh')),
  status text not null default 'active',
  primary_site_id uuid references public.sites(id) on delete set null,
  backup_site_id uuid references public.sites(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.wireless_links (
  id uuid primary key default gen_random_uuid(),
  network_id uuid references public.networks(id) on delete cascade,
  source_site_id uuid not null references public.sites(id) on delete cascade,
  destination_site_id uuid not null references public.sites(id) on delete cascade,
  frequency_mhz numeric not null,
  channel_width_mhz numeric not null,
  capacity_mbps numeric not null,
  status text not null default 'up',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ptmp_sectors (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  sector_name text not null,
  azimuth integer not null,
  beamwidth integer not null,
  max_subscribers integer not null default 64,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ptmp_clients (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.ptmp_sectors(id) on delete cascade,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  signal_strength numeric,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sector_id, subscriber_id)
);

create table if not exists public.spectrum_allocations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  equipment_id uuid references public.equipment(id) on delete set null,
  frequency_mhz numeric not null,
  bandwidth_mhz numeric not null,
  tx_power_dbm numeric,
  noise_floor_dbm numeric,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.qos_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  traffic_class text not null,
  priority integer not null,
  max_bandwidth_mbps integer not null,
  min_bandwidth_mbps integer not null default 0,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriber_qos (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  qos_profile_id uuid not null references public.qos_profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subscriber_id)
);

create table if not exists public.failover_policies (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.networks(id) on delete cascade,
  primary_link_id uuid not null references public.wireless_links(id) on delete cascade,
  backup_link_id uuid not null references public.wireless_links(id) on delete cascade,
  latency_threshold_ms numeric not null default 120,
  packet_loss_threshold numeric not null default 2.5,
  auto_failback boolean not null default true,
  enabled boolean not null default true,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.failover_events (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.failover_policies(id) on delete cascade,
  metric_id uuid references public.performance_metrics(id) on delete set null,
  action text not null,
  details text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.security_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  firewall_rules jsonb not null default '[]'::jsonb,
  vpn_enabled boolean not null default false,
  ids_enabled boolean not null default false,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.coverage_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_id uuid references public.sites(id) on delete set null,
  radius_km numeric,
  geojson jsonb,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.device_config_backups (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  version text not null,
  label text not null,
  config_blob text not null,
  created_by uuid references auth.users(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.firmware_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  firmware_version text not null,
  target_model text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.firmware_campaign_devices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.firmware_campaigns(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  status text not null default 'pending',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (campaign_id, equipment_id)
);

create table if not exists public.guest_networks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ssid text not null,
  vlan_id integer,
  passphrase text,
  isolation_enabled boolean not null default true,
  site_id uuid references public.sites(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.load_balancing_pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  algorithm text not null default 'round_robin',
  max_sessions integer not null default 10000,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.load_balancing_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.load_balancing_pools(id) on delete cascade,
  link_id uuid not null references public.wireless_links(id) on delete cascade,
  weight integer not null default 1,
  health_state text not null default 'healthy',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (pool_id, link_id)
);

create table if not exists public.mesh_nodes (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  parent_node_id uuid references public.mesh_nodes(id) on delete set null,
  hops integer not null default 0,
  status text not null default 'active',
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (equipment_id)
);

create table if not exists public.api_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider text not null,
  base_url text,
  api_key_encrypted text,
  enabled boolean not null default true,
  last_sync_at timestamptz,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.snmp_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null default 'v2c',
  community text,
  auth_protocol text,
  privacy_protocol text,
  poll_interval_sec integer not null default 60,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.traffic_shaping_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target_type text not null check (target_type in ('subscriber', 'site', 'plan')),
  target_id uuid not null,
  max_rate_mbps integer not null,
  burst_mbps integer not null default 0,
  priority integer not null default 5,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.mobile_commands (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  command text not null,
  status text not null default 'queued',
  requested_by uuid references auth.users(id) on delete set null,
  response text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 3) Automated failover event creation from high-latency/high-loss metrics
create or replace function public.evaluate_failover_on_metric()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eq public.equipment;
  p public.failover_policies;
begin
  select * into eq from public.equipment where id = new.equipment_id;

  for p in
    select *
    from public.failover_policies
    where organization_id = new.organization_id
      and enabled = true
  loop
    if new.latency > p.latency_threshold_ms or new.packet_loss > p.packet_loss_threshold then
      insert into public.failover_events (policy_id, metric_id, action, details, organization_id)
      values (
        p.id,
        new.id,
        'switch_to_backup',
        'Triggered by latency=' || new.latency || 'ms packet_loss=' || new.packet_loss || '%',
        new.organization_id
      );

      insert into public.alarms (severity, message, equipment_id, site_id, organization_id)
      values (
        'high',
        'Failover policy triggered for equipment ' || coalesce(eq.name, new.equipment_id::text),
        new.equipment_id,
        eq.site_id,
        new.organization_id
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_metric_failover on public.performance_metrics;
create trigger trg_metric_failover
after insert on public.performance_metrics
for each row execute function public.evaluate_failover_on_metric();

-- 4) Org-id auto-assignment triggers
create or replace function public.attach_org_trigger(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists trg_%s_org on public.%I', table_name, table_name);
  execute format('create trigger trg_%s_org before insert on public.%I for each row execute function public.set_org_id()', table_name, table_name);
end;
$$;

select public.attach_org_trigger('networks');
select public.attach_org_trigger('wireless_links');
select public.attach_org_trigger('ptmp_sectors');
select public.attach_org_trigger('ptmp_clients');
select public.attach_org_trigger('spectrum_allocations');
select public.attach_org_trigger('qos_profiles');
select public.attach_org_trigger('subscriber_qos');
select public.attach_org_trigger('failover_policies');
select public.attach_org_trigger('failover_events');
select public.attach_org_trigger('security_policies');
select public.attach_org_trigger('coverage_zones');
select public.attach_org_trigger('device_config_backups');
select public.attach_org_trigger('firmware_campaigns');
select public.attach_org_trigger('firmware_campaign_devices');
select public.attach_org_trigger('guest_networks');
select public.attach_org_trigger('load_balancing_pools');
select public.attach_org_trigger('load_balancing_members');
select public.attach_org_trigger('mesh_nodes');
select public.attach_org_trigger('api_integrations');
select public.attach_org_trigger('snmp_profiles');
select public.attach_org_trigger('traffic_shaping_policies');
select public.attach_org_trigger('mobile_commands');

-- 5) RLS for new tables
alter table public.networks enable row level security;
alter table public.wireless_links enable row level security;
alter table public.ptmp_sectors enable row level security;
alter table public.ptmp_clients enable row level security;
alter table public.spectrum_allocations enable row level security;
alter table public.qos_profiles enable row level security;
alter table public.subscriber_qos enable row level security;
alter table public.failover_policies enable row level security;
alter table public.failover_events enable row level security;
alter table public.security_policies enable row level security;
alter table public.coverage_zones enable row level security;
alter table public.device_config_backups enable row level security;
alter table public.firmware_campaigns enable row level security;
alter table public.firmware_campaign_devices enable row level security;
alter table public.guest_networks enable row level security;
alter table public.load_balancing_pools enable row level security;
alter table public.load_balancing_members enable row level security;
alter table public.mesh_nodes enable row level security;
alter table public.api_integrations enable row level security;
alter table public.snmp_profiles enable row level security;
alter table public.traffic_shaping_policies enable row level security;
alter table public.mobile_commands enable row level security;

create or replace function public.create_standard_org_policies(tbl text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I on public.%I', tbl || '_select', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_insert', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_update', tbl);
  execute format('drop policy if exists %I on public.%I', tbl || '_delete', tbl);

  execute format('create policy %I on public.%I for select using (organization_id = public.current_user_org_id())', tbl || '_select', tbl);
  execute format(
    'create policy %I on public.%I for insert with check (organization_id = public.current_user_org_id() and public.current_user_role() in (''admin'',''operator''))',
    tbl || '_insert',
    tbl
  );
  execute format(
    'create policy %I on public.%I for update using (organization_id = public.current_user_org_id() and public.current_user_role() in (''admin'',''operator'')) with check (organization_id = public.current_user_org_id() and public.current_user_role() in (''admin'',''operator''))',
    tbl || '_update',
    tbl
  );
  execute format(
    'create policy %I on public.%I for delete using (organization_id = public.current_user_org_id() and public.current_user_role() in (''admin'',''operator''))',
    tbl || '_delete',
    tbl
  );
end;
$$;

select public.create_standard_org_policies('networks');
select public.create_standard_org_policies('wireless_links');
select public.create_standard_org_policies('ptmp_sectors');
select public.create_standard_org_policies('ptmp_clients');
select public.create_standard_org_policies('spectrum_allocations');
select public.create_standard_org_policies('qos_profiles');
select public.create_standard_org_policies('subscriber_qos');
select public.create_standard_org_policies('failover_policies');
select public.create_standard_org_policies('failover_events');
select public.create_standard_org_policies('security_policies');
select public.create_standard_org_policies('coverage_zones');
select public.create_standard_org_policies('device_config_backups');
select public.create_standard_org_policies('firmware_campaigns');
select public.create_standard_org_policies('firmware_campaign_devices');
select public.create_standard_org_policies('guest_networks');
select public.create_standard_org_policies('load_balancing_pools');
select public.create_standard_org_policies('load_balancing_members');
select public.create_standard_org_policies('mesh_nodes');
select public.create_standard_org_policies('api_integrations');
select public.create_standard_org_policies('snmp_profiles');
select public.create_standard_org_policies('traffic_shaping_policies');
select public.create_standard_org_policies('mobile_commands');

-- technician can monitor certain operational tables
drop policy if exists equipment_technician_update on public.equipment;
create policy equipment_technician_update on public.equipment
for update
using (organization_id = public.current_user_org_id() and public.current_user_role() = 'technician')
with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'technician');

drop policy if exists performance_metrics_technician_insert on public.performance_metrics;
create policy performance_metrics_technician_insert on public.performance_metrics
for insert
with check (organization_id = public.current_user_org_id() and public.current_user_role() = 'technician');

commit;
