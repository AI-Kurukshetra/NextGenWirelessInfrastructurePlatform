begin;

-- Firmware rollout workflow depth
alter table public.firmware_campaigns
  add column if not exists rollout_strategy text default 'rolling',
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists notes text;

alter table public.firmware_campaign_devices
  add column if not exists previous_firmware_version text,
  add column if not exists error_message text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists idx_firmware_campaign_devices_campaign_status
  on public.firmware_campaign_devices (campaign_id, status);

-- Subscriber management depth
alter table public.subscribers
  add column if not exists account_number text,
  add column if not exists last_online_at timestamptz,
  add column if not exists access_control text default 'standard';

update public.subscribers
set account_number = coalesce(account_number, concat('ACC-', substr(id::text, 1, 8)))
where account_number is null;

create unique index if not exists idx_subscribers_account_number
  on public.subscribers (organization_id, account_number);

-- Equipment health depth
create table if not exists public.equipment_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  health_score integer not null,
  temperature numeric not null,
  latency numeric,
  packet_loss numeric,
  signal_strength numeric,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_equipment_health_snapshots_eq_created
  on public.equipment_health_snapshots (equipment_id, created_at desc);

alter table public.equipment_health_snapshots enable row level security;

drop trigger if exists trg_equipment_health_snapshots_org on public.equipment_health_snapshots;
create trigger trg_equipment_health_snapshots_org
before insert on public.equipment_health_snapshots
for each row execute function public.set_org_id();

drop policy if exists equipment_health_snapshots_select on public.equipment_health_snapshots;
drop policy if exists equipment_health_snapshots_insert on public.equipment_health_snapshots;
drop policy if exists equipment_health_snapshots_update on public.equipment_health_snapshots;
drop policy if exists equipment_health_snapshots_delete on public.equipment_health_snapshots;

create policy equipment_health_snapshots_select on public.equipment_health_snapshots
for select using (organization_id = public.current_user_org_id());

create policy equipment_health_snapshots_insert on public.equipment_health_snapshots
for insert with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator', 'technician')
);

create policy equipment_health_snapshots_update on public.equipment_health_snapshots
for update using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
)
with check (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create policy equipment_health_snapshots_delete on public.equipment_health_snapshots
for delete using (
  organization_id = public.current_user_org_id()
  and public.current_user_role() in ('admin', 'operator')
);

create or replace function public.calculate_health_score(
  p_status text,
  p_temperature numeric,
  p_latency numeric,
  p_packet_loss numeric,
  p_last_seen timestamptz
)
returns integer
language plpgsql
immutable
as $$
declare
  score numeric := 100;
begin
  if p_status = 'offline' then
    score := score - 50;
  elsif p_status = 'warning' then
    score := score - 25;
  end if;

  if p_temperature > 70 then
    score := score - 25;
  elsif p_temperature > 60 then
    score := score - 10;
  end if;

  if p_latency is not null and p_latency > 120 then
    score := score - 15;
  elsif p_latency is not null and p_latency > 80 then
    score := score - 8;
  end if;

  if p_packet_loss is not null and p_packet_loss > 3 then
    score := score - 15;
  elsif p_packet_loss is not null and p_packet_loss > 1 then
    score := score - 6;
  end if;

  if p_last_seen < now() - interval '20 minutes' then
    score := score - 20;
  end if;

  return greatest(0, least(100, round(score)::int));
end;
$$;

create or replace function public.capture_equipment_health_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eq public.equipment;
  score integer;
begin
  select * into eq from public.equipment where id = new.equipment_id;
  score := public.calculate_health_score(eq.status, eq.temperature, new.latency, new.packet_loss, eq.last_seen);

  insert into public.equipment_health_snapshots (
    equipment_id,
    organization_id,
    health_score,
    temperature,
    latency,
    packet_loss,
    signal_strength,
    status
  ) values (
    eq.id,
    new.organization_id,
    score,
    eq.temperature,
    new.latency,
    new.packet_loss,
    new.signal_strength,
    eq.status
  );

  return new;
end;
$$;

drop trigger if exists trg_capture_equipment_health_snapshot on public.performance_metrics;
create trigger trg_capture_equipment_health_snapshot
after insert on public.performance_metrics
for each row execute function public.capture_equipment_health_snapshot();

commit;
