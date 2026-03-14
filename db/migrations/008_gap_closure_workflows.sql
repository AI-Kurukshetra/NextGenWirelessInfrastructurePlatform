begin;

-- 3) Reporting capabilities (scheduled + export metadata)
create table if not exists public.report_jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  report_type text not null check (report_type in ('network_health', 'subscriber_growth', 'billing_summary', 'incident_summary', 'capacity_planning')),
  cadence text not null default 'manual' check (cadence in ('manual', 'daily', 'weekly', 'monthly')),
  output_format text not null default 'json' check (output_format in ('json', 'csv')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  filters jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  output_url text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4) Security operations depth (firewall/VPN/IDS observability)
create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('firewall_block', 'vpn_down', 'vpn_up', 'ids_alert', 'auth_failure')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  source_ip text,
  destination_ip text,
  protocol text,
  message text not null,
  policy_id uuid references public.security_policies(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.vpn_tunnels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'down' check (status in ('up', 'down', 'degraded')),
  local_endpoint text,
  remote_endpoint text,
  uptime_seconds bigint not null default 0,
  policy_id uuid references public.security_policies(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5) GIS depth via prediction overlays
create table if not exists public.coverage_predictions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.rf_propagation_models(id) on delete cascade,
  prediction_name text not null,
  confidence numeric not null default 0.75,
  recommended_radius_km numeric not null,
  recommended_geojson jsonb,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 6) Spectrum optimization depth
create table if not exists public.spectrum_scans (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  frequency_mhz numeric not null,
  noise_floor_dbm numeric,
  interference_score numeric not null default 0,
  channel_utilization numeric,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.channel_recommendations (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete set null,
  equipment_id uuid references public.equipment(id) on delete set null,
  current_frequency_mhz numeric,
  recommended_frequency_mhz numeric not null,
  reason text not null,
  confidence numeric not null default 0.6,
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'dismissed')),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 7) Realtime thresholding controls
create table if not exists public.metric_thresholds (
  id uuid primary key default gen_random_uuid(),
  target_type text not null default 'organization' check (target_type in ('organization', 'site', 'equipment')),
  target_id uuid,
  latency_max numeric,
  packet_loss_max numeric,
  temperature_max numeric,
  signal_strength_min numeric,
  enabled boolean not null default true,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, target_type, target_id)
);

-- 9) Subscriber AAA/provisioning coupling
create table if not exists public.subscriber_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  action text not null check (action in ('activate', 'suspend', 'resume', 'disconnect')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  equipment_id uuid references public.equipment(id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.subscriber_sessions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  session_state text not null default 'offline' check (session_state in ('online', 'offline', 'blocked')),
  ip_address text,
  mac_address text,
  nas_identifier text,
  started_at timestamptz,
  ended_at timestamptz,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscriber_id)
);

-- 10) Predictive maintenance depth
create table if not exists public.predictive_maintenance_scores (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  failure_window_hours integer not null default 72,
  recommendation text not null,
  factors jsonb not null default '{}'::jsonb,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 12) Innovation ideas tracker and pilots
create table if not exists public.innovation_backlog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  maturity text not null default 'idea' check (maturity in ('idea', 'research', 'pilot', 'production')),
  impact_score integer not null default 3 check (impact_score between 1 and 5),
  effort_score integer not null default 3 check (effort_score between 1 and 5),
  notes text,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.innovation_pilots (
  id uuid primary key default gen_random_uuid(),
  backlog_id uuid not null references public.innovation_backlog(id) on delete cascade,
  status text not null default 'planned' check (status in ('planned', 'running', 'completed', 'aborted')),
  hypothesis text,
  result_summary text,
  metrics jsonb not null default '{}'::jsonb,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_report_jobs_org_status on public.report_jobs (organization_id, status, created_at desc);
create index if not exists idx_security_events_org_created on public.security_events (organization_id, created_at desc);
create index if not exists idx_spectrum_scans_org_created on public.spectrum_scans (organization_id, created_at desc);
create index if not exists idx_channel_reco_org_status on public.channel_recommendations (organization_id, status, created_at desc);
create index if not exists idx_metric_thresholds_org_target on public.metric_thresholds (organization_id, target_type, target_id);
create index if not exists idx_sub_prov_jobs_org_created on public.subscriber_provisioning_jobs (organization_id, created_at desc);
create index if not exists idx_sub_sessions_org_state on public.subscriber_sessions (organization_id, session_state, updated_at desc);
create index if not exists idx_predictive_scores_org_created on public.predictive_maintenance_scores (organization_id, created_at desc);
create index if not exists idx_innovation_backlog_org_maturity on public.innovation_backlog (organization_id, maturity);

-- Reuse updated_at helper if already present
create or replace function public.touch_updated_at_generic()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_vpn_tunnels_updated_at on public.vpn_tunnels;
create trigger trg_vpn_tunnels_updated_at before update on public.vpn_tunnels
for each row execute function public.touch_updated_at_generic();

drop trigger if exists trg_subscriber_sessions_updated_at on public.subscriber_sessions;
create trigger trg_subscriber_sessions_updated_at before update on public.subscriber_sessions
for each row execute function public.touch_updated_at_generic();

drop trigger if exists trg_innovation_backlog_updated_at on public.innovation_backlog;
create trigger trg_innovation_backlog_updated_at before update on public.innovation_backlog
for each row execute function public.touch_updated_at_generic();

drop trigger if exists trg_innovation_pilots_updated_at on public.innovation_pilots;
create trigger trg_innovation_pilots_updated_at before update on public.innovation_pilots
for each row execute function public.touch_updated_at_generic();

-- Attach org trigger + RLS/policies
select public.attach_org_trigger('report_jobs');
select public.attach_org_trigger('security_events');
select public.attach_org_trigger('vpn_tunnels');
select public.attach_org_trigger('coverage_predictions');
select public.attach_org_trigger('spectrum_scans');
select public.attach_org_trigger('channel_recommendations');
select public.attach_org_trigger('metric_thresholds');
select public.attach_org_trigger('subscriber_provisioning_jobs');
select public.attach_org_trigger('subscriber_sessions');
select public.attach_org_trigger('predictive_maintenance_scores');
select public.attach_org_trigger('innovation_backlog');
select public.attach_org_trigger('innovation_pilots');

alter table public.report_jobs enable row level security;
alter table public.security_events enable row level security;
alter table public.vpn_tunnels enable row level security;
alter table public.coverage_predictions enable row level security;
alter table public.spectrum_scans enable row level security;
alter table public.channel_recommendations enable row level security;
alter table public.metric_thresholds enable row level security;
alter table public.subscriber_provisioning_jobs enable row level security;
alter table public.subscriber_sessions enable row level security;
alter table public.predictive_maintenance_scores enable row level security;
alter table public.innovation_backlog enable row level security;
alter table public.innovation_pilots enable row level security;

select public.create_standard_org_policies('report_jobs');
select public.create_standard_org_policies('security_events');
select public.create_standard_org_policies('vpn_tunnels');
select public.create_standard_org_policies('coverage_predictions');
select public.create_standard_org_policies('spectrum_scans');
select public.create_standard_org_policies('channel_recommendations');
select public.create_standard_org_policies('metric_thresholds');
select public.create_standard_org_policies('subscriber_provisioning_jobs');
select public.create_standard_org_policies('subscriber_sessions');
select public.create_standard_org_policies('predictive_maintenance_scores');
select public.create_standard_org_policies('innovation_backlog');
select public.create_standard_org_policies('innovation_pilots');

-- 7) Threshold-triggered realtime alarms
create or replace function public.raise_threshold_alarm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eq public.equipment;
  t public.metric_thresholds;
  effective_latency_max numeric := 120;
  effective_loss_max numeric := 3;
  effective_temp_max numeric := 70;
  effective_signal_min numeric := -75;
begin
  select * into eq from public.equipment where id = new.equipment_id;

  -- Prefer equipment-level, then site-level, then org-level threshold
  select * into t
  from public.metric_thresholds
  where organization_id = new.organization_id
    and enabled = true
    and (
      (target_type = 'equipment' and target_id = new.equipment_id)
      or (target_type = 'site' and target_id = eq.site_id)
      or (target_type = 'organization' and target_id is null)
    )
  order by case target_type when 'equipment' then 1 when 'site' then 2 else 3 end
  limit 1;

  if t.id is not null then
    effective_latency_max := coalesce(t.latency_max, effective_latency_max);
    effective_loss_max := coalesce(t.packet_loss_max, effective_loss_max);
    effective_temp_max := coalesce(t.temperature_max, effective_temp_max);
    effective_signal_min := coalesce(t.signal_strength_min, effective_signal_min);
  end if;

  if new.latency > effective_latency_max then
    insert into public.alarms(severity, message, equipment_id, site_id, organization_id)
    values ('high', 'Threshold breach: latency ' || new.latency || 'ms', new.equipment_id, eq.site_id, new.organization_id);
  end if;

  if new.packet_loss > effective_loss_max then
    insert into public.alarms(severity, message, equipment_id, site_id, organization_id)
    values ('high', 'Threshold breach: packet loss ' || new.packet_loss || '%', new.equipment_id, eq.site_id, new.organization_id);
  end if;

  if new.signal_strength < effective_signal_min then
    insert into public.alarms(severity, message, equipment_id, site_id, organization_id)
    values ('medium', 'Threshold breach: weak signal ' || new.signal_strength || ' dBm', new.equipment_id, eq.site_id, new.organization_id);
  end if;

  if eq.temperature > effective_temp_max then
    insert into public.alarms(severity, message, equipment_id, site_id, organization_id)
    values ('critical', 'Threshold breach: equipment temperature ' || eq.temperature || ' C', eq.id, eq.site_id, new.organization_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_metric_threshold_alarm on public.performance_metrics;
create trigger trg_metric_threshold_alarm
after insert on public.performance_metrics
for each row execute function public.raise_threshold_alarm();

commit;
