import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const cwd = process.cwd();
const envLocal = path.join(cwd, ".env.local");
const envFile = path.join(cwd, ".env");
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceRoleKey);

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function ensureOwnerOrgId() {
  const {
    data: { users },
    error: usersError,
  } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  if (!users.length) throw new Error("Create at least one auth user before seeding.");

  const requestedSeedUser = process.env.SEED_OWNER_EMAIL?.toLowerCase();
  const ownerUser = users.find((u) => u.email?.toLowerCase() === requestedSeedUser) ?? users[0];

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", ownerUser.id)
    .single();
  if (profileError) throw profileError;

  return profile.organization_id as string;
}

async function ensureServicePlans(organizationId: string) {
  const planDefs = [
    { name: "Starter 50", speed_limit: 50, monthly_price: 29, bandwidth_cap: 500 },
    { name: "Business 200", speed_limit: 200, monthly_price: 79, bandwidth_cap: 2500 },
    { name: "Enterprise 500", speed_limit: 500, monthly_price: 149, bandwidth_cap: 10000 },
  ];

  const { data: existing, error } = await supabase
    .from("service_plans")
    .select("id,name")
    .eq("organization_id", organizationId)
    .in("name", planDefs.map((p) => p.name));
  if (error) throw error;

  const existingNames = new Set(existing.map((p) => p.name));
  const toInsert = planDefs
    .filter((p) => !existingNames.has(p.name))
    .map((p) => ({ ...p, organization_id: organizationId }));

  if (toInsert.length) {
    const { error: insertError } = await supabase.from("service_plans").insert(toInsert);
    if (insertError) throw insertError;
  }

  const { data: plans, error: refetchError } = await supabase
    .from("service_plans")
    .select("id,name,speed_limit")
    .eq("organization_id", organizationId)
    .in("name", planDefs.map((p) => p.name));
  if (refetchError) throw refetchError;

  return plans;
}

async function ensureSites(organizationId: string) {
  const { data: existing, error } = await supabase
    .from("sites")
    .select("id,name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const target = 10;
  const toCreate = Math.max(0, target - existing.length);
  if (toCreate > 0) {
    const offset = existing.length;
    const payload = Array.from({ length: toCreate }).map((_, i) => ({
      name: `Site-${offset + i + 1}`,
      latitude: Number(randomBetween(18.5, 19.6).toFixed(5)),
      longitude: Number(randomBetween(72.6, 73.9).toFixed(5)),
      tower_height: Math.floor(randomBetween(20, 75)),
      organization_id: organizationId,
    }));
    const { error: insertError } = await supabase.from("sites").insert(payload);
    if (insertError) throw insertError;
  }

  const { data: sites, error: refetchError } = await supabase
    .from("sites")
    .select("id,name")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(target);
  if (refetchError) throw refetchError;

  return sites;
}

async function ensureEquipment(organizationId: string, sites: { id: string }[]) {
  const { data: existing, error } = await supabase
    .from("equipment")
    .select("id")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const target = 20;
  const toCreate = Math.max(0, target - existing.length);
  if (toCreate > 0) {
    const payload = Array.from({ length: toCreate }).map((_, idx) => {
      const absolute = existing.length + idx;
      return {
        name: `Radio-${absolute + 1}`,
        model: absolute % 2 === 0 ? "Cambium ePMP 3000" : "MikroTik LHG 5",
        vendor: absolute % 2 === 0 ? "cambium" : "mikrotik",
        management_ip: `10.10.${Math.floor(absolute / 250)}.${(absolute % 250) + 1}`,
        provisioning_state: absolute % 5 === 0 ? "provisioned" : "unprovisioned",
        firmware_version: absolute % 2 === 0 ? "4.8.2" : "7.12.3",
        site_id: sites[absolute % sites.length].id,
        organization_id: organizationId,
        status: absolute % 9 === 0 ? "offline" : "online",
        temperature: Number(randomBetween(28, 78).toFixed(1)),
        last_seen: new Date(Date.now() - randomBetween(0, 40) * 60 * 1000).toISOString(),
      };
    });
    const { error: insertError } = await supabase.from("equipment").insert(payload);
    if (insertError) throw insertError;
  }

  const { data: rows, error: refetchError } = await supabase
    .from("equipment")
    .select("id,site_id,model,vendor,firmware_version,status")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(target);
  if (refetchError) throw refetchError;

  return rows;
}

async function ensureSubscribers(organizationId: string, plans: { id: string; speed_limit: number }[], sites: { id: string }[]) {
  const { count, error } = await supabase
    .from("subscribers")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId);
  if (error) throw error;

  const current = count ?? 0;
  const target = 100;
  const toCreate = Math.max(0, target - current);

  if (toCreate > 0) {
    const orgToken = organizationId.slice(0, 8);
    const payload = Array.from({ length: toCreate }).map((_, idx) => {
      const absolute = current + idx;
      const plan = plans[absolute % plans.length];
      return {
        name: `Subscriber ${absolute + 1}`,
        email: `subscriber${absolute + 1}.${orgToken}@example.net`,
        service_plan_id: plan.id,
        status: absolute % 15 === 0 ? "suspended" : "active",
        connection_site: sites[absolute % sites.length].id,
        organization_id: organizationId,
        account_number: `ACC-${organizationId.slice(0, 6)}-${String(absolute + 1).padStart(4, "0")}`,
        access_control: absolute % 12 === 0 ? "restricted" : absolute % 7 === 0 ? "premium" : "standard",
        enforced_speed_limit: plan.speed_limit,
      };
    });

    const { error: insertError } = await supabase.from("subscribers").insert(payload);
    if (insertError) throw insertError;
  }

  const { data: rows, error: refetchError } = await supabase
    .from("subscribers")
    .select("id,service_plan_id,connection_site")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(target);
  if (refetchError) throw refetchError;

  return rows;
}

async function ensureMetrics(organizationId: string, devices: { id: string }[]) {
  const { count, error } = await supabase
    .from("performance_metrics")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId);
  if (error) throw error;

  const current = count ?? 0;
  const target = 200;
  const toCreate = Math.max(0, target - current);

  if (toCreate > 0) {
    const payload = Array.from({ length: toCreate }).map((_, idx) => {
      const absolute = current + idx;
      const device = devices[absolute % devices.length];
      const createdAt = new Date(Date.now() - (toCreate - idx) * 10 * 60 * 1000);
      return {
        equipment_id: device.id,
        organization_id: organizationId,
        throughput: Number(randomBetween(20, 450).toFixed(2)),
        latency: Number(randomBetween(12, 120).toFixed(2)),
        packet_loss: Number(randomBetween(0, 5).toFixed(2)),
        signal_strength: Number(randomBetween(-75, -45).toFixed(2)),
        recorded_at: createdAt.toISOString(),
      };
    });
    const { error: insertError } = await supabase.from("performance_metrics").insert(payload);
    if (insertError) throw insertError;
  }
}

async function ensureNetworks(organizationId: string, sites: { id: string }[]) {
  const defs = [
    { name: "Backbone P2P", topology: "p2p" },
    { name: "Metro PTMP", topology: "ptmp" },
    { name: "Edge Mesh", topology: "mesh" },
  ];

  const { data: existing, error } = await supabase
    .from("networks")
    .select("id,name,topology")
    .eq("organization_id", organizationId)
    .in("name", defs.map((d) => d.name));
  if (error) throw error;

  const names = new Set(existing.map((n) => n.name));
  const toInsert = defs
    .filter((d) => !names.has(d.name))
    .map((d, i) => ({
      ...d,
      status: "active",
      primary_site_id: sites[i % sites.length].id,
      backup_site_id: sites[(i + 1) % sites.length].id,
      organization_id: organizationId,
    }));

  if (toInsert.length) {
    const { error: insertError } = await supabase.from("networks").insert(toInsert);
    if (insertError) throw insertError;
  }

  const { data: rows, error: refetchError } = await supabase
    .from("networks")
    .select("id,name,topology")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (refetchError) throw refetchError;

  return rows;
}

async function ensureWirelessLinks(organizationId: string, networks: { id: string }[], sites: { id: string }[]) {
  const { data: existing, error } = await supabase
    .from("wireless_links")
    .select("id")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const target = 8;
  const toCreate = Math.max(0, target - existing.length);

  if (toCreate > 0) {
    const payload = Array.from({ length: toCreate }).map((_, idx) => {
      const absolute = existing.length + idx;
      return {
        network_id: networks[absolute % networks.length].id,
        source_site_id: sites[absolute % sites.length].id,
        destination_site_id: sites[(absolute + 1) % sites.length].id,
        frequency_mhz: Number(randomBetween(5100, 5900).toFixed(1)),
        channel_width_mhz: [20, 40, 80][absolute % 3],
        capacity_mbps: [200, 500, 1000][absolute % 3],
        status: absolute % 6 === 0 ? "down" : "up",
        organization_id: organizationId,
      };
    });

    const { error: insertError } = await supabase.from("wireless_links").insert(payload);
    if (insertError) throw insertError;
  }

  const { data: rows, error: refetchError } = await supabase
    .from("wireless_links")
    .select("id,network_id,source_site_id,destination_site_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (refetchError) throw refetchError;

  return rows;
}

async function ensurePtmp(organizationId: string, sites: { id: string }[], subscribers: { id: string }[]) {
  const { data: sectors, error: sectorsError } = await supabase
    .from("ptmp_sectors")
    .select("id")
    .eq("organization_id", organizationId);
  if (sectorsError) throw sectorsError;

  if (sectors.length < 4) {
    const payload = Array.from({ length: 4 - sectors.length }).map((_, i) => ({
      site_id: sites[i % sites.length].id,
      sector_name: `Sector-${sectors.length + i + 1}`,
      azimuth: (i * 60) % 360,
      beamwidth: 60,
      max_subscribers: 64,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("ptmp_sectors").insert(payload);
    if (error) throw error;
  }

  const { data: allSectors, error: allSectorsError } = await supabase
    .from("ptmp_sectors")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (allSectorsError) throw allSectorsError;

  const { data: clients, error: clientsError } = await supabase
    .from("ptmp_clients")
    .select("id", { count: "exact" })
    .eq("organization_id", organizationId);
  if (clientsError) throw clientsError;

  const current = clients.length;
  const target = 20;
  if (current < target) {
    const payload = Array.from({ length: target - current }).map((_, i) => ({
      sector_id: allSectors[i % allSectors.length].id,
      subscriber_id: subscribers[(current + i) % subscribers.length].id,
      signal_strength: Number(randomBetween(-75, -45).toFixed(2)),
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("ptmp_clients").upsert(payload, { onConflict: "sector_id,subscriber_id" });
    if (error) throw error;
  }
}

async function ensureSpectrumAllocations(organizationId: string, sites: { id: string }[], devices: { id: string }[]) {
  const { data: existing, error } = await supabase
    .from("spectrum_allocations")
    .select("id")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const target = 20;
  if (existing.length < target) {
    const payload = Array.from({ length: target - existing.length }).map((_, i) => ({
      site_id: sites[i % sites.length].id,
      equipment_id: devices[i % devices.length].id,
      frequency_mhz: Number(randomBetween(5100, 5900).toFixed(1)),
      bandwidth_mhz: [20, 40, 80][i % 3],
      tx_power_dbm: Number(randomBetween(15, 28).toFixed(1)),
      noise_floor_dbm: Number(randomBetween(-110, -88).toFixed(1)),
      organization_id: organizationId,
    }));
    const { error: insertError } = await supabase.from("spectrum_allocations").insert(payload);
    if (insertError) throw insertError;
  }
}

async function ensureQos(organizationId: string, subscribers: { id: string }[]) {
  const profileDefs = [
    { name: "Voice Priority", traffic_class: "voice", priority: 1, max_bandwidth_mbps: 50, min_bandwidth_mbps: 20 },
    { name: "Business Critical", traffic_class: "business", priority: 2, max_bandwidth_mbps: 150, min_bandwidth_mbps: 50 },
    { name: "Best Effort", traffic_class: "default", priority: 5, max_bandwidth_mbps: 80, min_bandwidth_mbps: 5 },
  ];

  const { data: existingProfiles, error: profilesError } = await supabase
    .from("qos_profiles")
    .select("id,name")
    .eq("organization_id", organizationId)
    .in("name", profileDefs.map((p) => p.name));
  if (profilesError) throw profilesError;

  const names = new Set(existingProfiles.map((p) => p.name));
  const toInsert = profileDefs.filter((p) => !names.has(p.name)).map((p) => ({ ...p, organization_id: organizationId }));
  if (toInsert.length) {
    const { error } = await supabase.from("qos_profiles").insert(toInsert);
    if (error) throw error;
  }

  const { data: profiles, error: refetchError } = await supabase
    .from("qos_profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (refetchError) throw refetchError;

  const { data: assignments, error: assignError } = await supabase
    .from("subscriber_qos")
    .select("subscriber_id")
    .eq("organization_id", organizationId);
  if (assignError) throw assignError;

  const assigned = new Set(assignments.map((a) => a.subscriber_id));
  const toAssign = subscribers.filter((s) => !assigned.has(s.id)).slice(0, 50);
  if (toAssign.length) {
    const payload = toAssign.map((s, i) => ({
      subscriber_id: s.id,
      qos_profile_id: profiles[i % profiles.length].id,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("subscriber_qos").insert(payload);
    if (error) throw error;
  }
}

async function ensureFailover(organizationId: string, networks: { id: string }[], links: { id: string }[]) {
  if (links.length < 2 || networks.length === 0) return;

  const { data: existing, error } = await supabase
    .from("failover_policies")
    .select("id")
    .eq("organization_id", organizationId);
  if (error) throw error;

  if (existing.length < 2) {
    const payload = Array.from({ length: 2 - existing.length }).map((_, i) => ({
      network_id: networks[i % networks.length].id,
      primary_link_id: links[i % links.length].id,
      backup_link_id: links[(i + 1) % links.length].id,
      latency_threshold_ms: 100,
      packet_loss_threshold: 2.5,
      auto_failback: true,
      enabled: true,
      organization_id: organizationId,
    }));
    const { error: insertError } = await supabase.from("failover_policies").insert(payload);
    if (insertError) throw insertError;
  }

  const { data: policies, error: policiesError } = await supabase
    .from("failover_policies")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (policiesError) throw policiesError;

  const { data: events, error: eventsError } = await supabase
    .from("failover_events")
    .select("id")
    .eq("organization_id", organizationId);
  if (eventsError) throw eventsError;

  if (events.length < 5) {
    const payload = Array.from({ length: 5 - events.length }).map((_, i) => ({
      policy_id: policies[i % policies.length].id,
      action: "switch_to_backup",
      details: `Simulated failover event ${i + 1}`,
      organization_id: organizationId,
    }));
    const { error: insertError } = await supabase.from("failover_events").insert(payload);
    if (insertError) throw insertError;
  }
}

async function ensureSecurityCoverageGuest(organizationId: string, sites: { id: string }[]) {
  const { data: sec, error: secError } = await supabase
    .from("security_policies")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(1);
  if (secError) throw secError;
  if (!sec.length) {
    const { error } = await supabase.from("security_policies").insert({
      name: "Default Security",
      firewall_rules: [{ allow: "443/tcp" }, { deny: "23/tcp" }],
      vpn_enabled: true,
      ids_enabled: true,
      organization_id: organizationId,
    });
    if (error) throw error;
  }

  const { data: zones, error: zoneError } = await supabase
    .from("coverage_zones")
    .select("id")
    .eq("organization_id", organizationId);
  if (zoneError) throw zoneError;
  if (zones.length < 5) {
    const payload = Array.from({ length: 5 - zones.length }).map((_, i) => ({
      name: `Coverage Zone ${i + 1}`,
      site_id: sites[i % sites.length].id,
      radius_km: Number(randomBetween(2, 12).toFixed(2)),
      geojson: { type: "Point", coordinates: [Number(randomBetween(72.6, 73.9).toFixed(5)), Number(randomBetween(18.5, 19.6).toFixed(5))] },
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("coverage_zones").insert(payload);
    if (error) throw error;
  }

  const { data: guests, error: guestError } = await supabase
    .from("guest_networks")
    .select("id")
    .eq("organization_id", organizationId);
  if (guestError) throw guestError;
  if (guests.length < 3) {
    const payload = Array.from({ length: 3 - guests.length }).map((_, i) => ({
      name: `Guest Network ${i + 1}`,
      ssid: `Guest-${i + 1}`,
      vlan_id: 100 + i,
      passphrase: `guest-${organizationId.slice(0, 4)}-${i + 1}`,
      isolation_enabled: true,
      site_id: sites[i % sites.length].id,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("guest_networks").insert(payload);
    if (error) throw error;
  }
}

async function ensureConfigAndFirmware(organizationId: string, devices: { id: string; model: string; firmware_version: string }[]) {
  const { data: backups, error: backupError } = await supabase
    .from("device_config_backups")
    .select("id")
    .eq("organization_id", organizationId);
  if (backupError) throw backupError;

  if (backups.length < 20) {
    const payload = Array.from({ length: 20 - backups.length }).map((_, i) => ({
      equipment_id: devices[i % devices.length].id,
      version: `v${1 + (i % 3)}`,
      label: `seed-backup-${i + 1}`,
      config_blob: `interface wlan1\nssid=seed-${i + 1}\nfrequency=${Number(randomBetween(5200, 5900).toFixed(0))}`,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("device_config_backups").insert(payload);
    if (error) throw error;
  }

  const campaigns = [
    { name: "Wave 1 Upgrade", firmware_version: "8.0.1", target_model: "Cambium ePMP 3000", status: "completed", rollout_strategy: "rolling" },
    { name: "Wave 2 Canary", firmware_version: "8.1.0", target_model: "MikroTik", status: "in_progress", rollout_strategy: "canary" },
  ];

  const { data: existingCampaigns, error: campaignsError } = await supabase
    .from("firmware_campaigns")
    .select("id,name,organization_id")
    .eq("organization_id", organizationId)
    .in("name", campaigns.map((c) => c.name));
  if (campaignsError) throw campaignsError;

  const campaignNames = new Set(existingCampaigns.map((c) => c.name));
  const toInsert = campaigns.filter((c) => !campaignNames.has(c.name)).map((c) => ({ ...c, organization_id: organizationId }));
  if (toInsert.length) {
    const { error } = await supabase.from("firmware_campaigns").insert(toInsert);
    if (error) throw error;
  }

  const { data: allCampaigns, error: refetchError } = await supabase
    .from("firmware_campaigns")
    .select("id,name")
    .eq("organization_id", organizationId)
    .in("name", campaigns.map((c) => c.name));
  if (refetchError) throw refetchError;

  const wave1 = allCampaigns.find((c) => c.name === "Wave 1 Upgrade");
  if (wave1) {
    const payload = devices.slice(0, 10).map((d, i) => ({
      campaign_id: wave1.id,
      equipment_id: d.id,
      status: i % 7 === 0 ? "failed" : "applied",
      previous_firmware_version: d.firmware_version,
      error_message: i % 7 === 0 ? "Device offline during upgrade" : null,
      started_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 47 * 60 * 60 * 1000).toISOString(),
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("firmware_campaign_devices").upsert(payload, { onConflict: "campaign_id,equipment_id" });
    if (error) throw error;
  }
}

async function ensureLoadBalancingAndMesh(organizationId: string, links: { id: string }[], devices: { id: string }[]) {
  const { data: pools, error: poolError } = await supabase
    .from("load_balancing_pools")
    .select("id,name")
    .eq("organization_id", organizationId)
    .in("name", ["ISP Pool A", "ISP Pool B"]);
  if (poolError) throw poolError;

  const poolNames = new Set(pools.map((p) => p.name));
  const toInsertPools = [
    { name: "ISP Pool A", algorithm: "round_robin", max_sessions: 10000, organization_id: organizationId },
    { name: "ISP Pool B", algorithm: "weighted", max_sessions: 15000, organization_id: organizationId },
  ].filter((p) => !poolNames.has(p.name));
  if (toInsertPools.length) {
    const { error } = await supabase.from("load_balancing_pools").insert(toInsertPools);
    if (error) throw error;
  }

  const { data: allPools, error: allPoolsError } = await supabase
    .from("load_balancing_pools")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (allPoolsError) throw allPoolsError;

  if (allPools.length && links.length) {
    const payload = links.slice(0, 6).map((l, i) => ({
      pool_id: allPools[i % allPools.length].id,
      link_id: l.id,
      weight: 1 + (i % 3),
      health_state: i % 8 === 0 ? "degraded" : "healthy",
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("load_balancing_members").upsert(payload, { onConflict: "pool_id,link_id" });
    if (error) throw error;
  }

  const meshPayload = devices.slice(0, 8).map((d, i) => ({
    equipment_id: d.id,
    parent_node_id: i === 0 ? null : undefined,
    hops: i,
    status: i % 5 === 0 ? "degraded" : "active",
    organization_id: organizationId,
  }));

  const { data: existingMesh, error: meshError } = await supabase
    .from("mesh_nodes")
    .select("id,equipment_id")
    .eq("organization_id", organizationId);
  if (meshError) throw meshError;

  const existingByEq = new Set(existingMesh.map((m) => m.equipment_id));
  const toInsertMesh = meshPayload.filter((m) => !existingByEq.has(m.equipment_id));
  if (toInsertMesh.length) {
    const { error } = await supabase.from("mesh_nodes").insert(toInsertMesh);
    if (error) throw error;
  }
}

async function ensureIntegrationsSnmpTrafficMobile(organizationId: string, subscribers: { id: string }[], sites: { id: string }[], plans: { id: string }[], devices: { id: string }[]) {
  const integrationDefs = [
    { name: "CRM Sync", provider: "Salesforce", base_url: "https://api.crm.local" },
    { name: "NOC Pager", provider: "PagerDuty", base_url: "https://events.pagerduty.com" },
    { name: "Billing Bridge", provider: "Stripe", base_url: "https://api.stripe.com" },
  ];

  const { data: existingInt, error: intError } = await supabase
    .from("api_integrations")
    .select("name")
    .eq("organization_id", organizationId)
    .in("name", integrationDefs.map((d) => d.name));
  if (intError) throw intError;
  const intNames = new Set(existingInt.map((i) => i.name));
  const toInsertInt = integrationDefs
    .filter((d) => !intNames.has(d.name))
    .map((d) => ({ ...d, api_key_encrypted: "seed-token", enabled: true, organization_id: organizationId }));
  if (toInsertInt.length) {
    const { error } = await supabase.from("api_integrations").insert(toInsertInt);
    if (error) throw error;
  }

  const snmpDefs = [
    { name: "SNMP v2c Default", version: "v2c", community: "public", poll_interval_sec: 60 },
    { name: "SNMP v3 Secure", version: "v3", auth_protocol: "SHA", privacy_protocol: "AES", poll_interval_sec: 30 },
  ];
  const { data: existingSnmp, error: snmpError } = await supabase
    .from("snmp_profiles")
    .select("name")
    .eq("organization_id", organizationId)
    .in("name", snmpDefs.map((d) => d.name));
  if (snmpError) throw snmpError;
  const snmpNames = new Set(existingSnmp.map((s) => s.name));
  const toInsertSnmp = snmpDefs.filter((d) => !snmpNames.has(d.name)).map((d) => ({ ...d, organization_id: organizationId }));
  if (toInsertSnmp.length) {
    const { error } = await supabase.from("snmp_profiles").insert(toInsertSnmp);
    if (error) throw error;
  }

  const { data: existingTs, error: tsError } = await supabase
    .from("traffic_shaping_policies")
    .select("id")
    .eq("organization_id", organizationId);
  if (tsError) throw tsError;
  if (existingTs.length < 6) {
    const payload = [
      { name: "Plan Gold", target_type: "plan", target_id: plans[0].id, max_rate_mbps: 200, burst_mbps: 40, priority: 2, organization_id: organizationId },
      { name: "Plan Bronze", target_type: "plan", target_id: plans[1].id, max_rate_mbps: 80, burst_mbps: 15, priority: 5, organization_id: organizationId },
      { name: "Site Burst", target_type: "site", target_id: sites[0].id, max_rate_mbps: 500, burst_mbps: 120, priority: 3, organization_id: organizationId },
      { name: "Subscriber Strict", target_type: "subscriber", target_id: subscribers[0].id, max_rate_mbps: 30, burst_mbps: 0, priority: 1, organization_id: organizationId },
      { name: "Subscriber Flex", target_type: "subscriber", target_id: subscribers[1].id, max_rate_mbps: 60, burst_mbps: 10, priority: 4, organization_id: organizationId },
      { name: "Site Evening", target_type: "site", target_id: sites[1].id, max_rate_mbps: 300, burst_mbps: 50, priority: 4, organization_id: organizationId },
    ].slice(0, 6 - existingTs.length);
    const { error } = await supabase.from("traffic_shaping_policies").insert(payload);
    if (error) throw error;
  }

  const { data: commands, error: commandError } = await supabase
    .from("mobile_commands")
    .select("id")
    .eq("organization_id", organizationId);
  if (commandError) throw commandError;
  if (commands.length < 15) {
    const payload = Array.from({ length: 15 - commands.length }).map((_, i) => ({
      equipment_id: devices[i % devices.length].id,
      command: ["reboot", "sync_config", "capture_diagnostics"][i % 3],
      status: i % 6 === 0 ? "failed" : i % 2 === 0 ? "completed" : "queued",
      response: i % 6 === 0 ? "Timeout" : "OK",
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("mobile_commands").insert(payload);
    if (error) throw error;
  }
}

async function ensureEquipmentHealthSnapshots(organizationId: string, devices: { id: string; status: string }[]) {
  const { count, error } = await supabase
    .from("equipment_health_snapshots")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", organizationId);
  if (error) throw error;

  const current = count ?? 0;
  const target = 120;
  if (current < target) {
    const payload = Array.from({ length: target - current }).map((_, i) => {
      const d = devices[i % devices.length];
      const latency = Number(randomBetween(8, 140).toFixed(2));
      const loss = Number(randomBetween(0, 5).toFixed(2));
      const temp = Number(randomBetween(24, 80).toFixed(2));
      const base = d.status === "offline" ? 35 : 85;
      const score = Math.max(5, Math.min(100, Math.round(base - (latency > 100 ? 20 : 0) - (loss > 2.5 ? 15 : 0) - (temp > 70 ? 20 : 0))));
      return {
        equipment_id: d.id,
        organization_id: organizationId,
        health_score: score,
        temperature: temp,
        latency,
        packet_loss: loss,
        signal_strength: Number(randomBetween(-75, -45).toFixed(2)),
        status: d.status,
        created_at: new Date(Date.now() - (target - i) * 5 * 60 * 1000).toISOString(),
      };
    });

    const { error: insertError } = await supabase.from("equipment_health_snapshots").insert(payload);
    if (insertError) throw insertError;
  }
}

async function ensureBlueprintExpansion(
  organizationId: string,
  sites: { id: string; latitude?: number; longitude?: number }[],
  devices: { id: string }[],
  subscribers: { id: string }[]
) {
  const { data: tickets, error: ticketsErr } = await supabase.from("tickets").select("id").eq("organization_id", organizationId);
  if (ticketsErr) throw ticketsErr;
  if (tickets.length < 15) {
    const payload = Array.from({ length: 15 - tickets.length }).map((_, i) => ({
      title: `Ticket ${i + 1} - connectivity issue`,
      description: "Seeded operational ticket",
      status: ["open", "in_progress", "resolved"][i % 3],
      priority: ["low", "medium", "high", "critical"][i % 4],
      site_id: sites[i % sites.length]?.id ?? null,
      equipment_id: devices[i % devices.length]?.id ?? null,
      subscriber_id: subscribers[i % subscribers.length]?.id ?? null,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("tickets").insert(payload);
    if (error) throw error;
  }

  const { data: inventory, error: invErr } = await supabase.from("inventory_items").select("id").eq("organization_id", organizationId);
  if (invErr) throw invErr;
  if (inventory.length < 25) {
    const payload = Array.from({ length: 25 - inventory.length }).map((_, i) => ({
      name: `Inventory Item ${i + 1}`,
      category: ["radio", "antenna", "switch", "cable"][i % 4],
      vendor: i % 2 === 0 ? "Cambium" : "MikroTik",
      model: `Model-${(i % 7) + 1}`,
      serial_number: `SN-${organizationId.slice(0, 6)}-${String(i + 1).padStart(4, "0")}`,
      quantity: 1 + (i % 9),
      status: ["in_stock", "allocated", "maintenance"][i % 3],
      site_id: sites[i % sites.length]?.id ?? null,
      equipment_id: devices[i % devices.length]?.id ?? null,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("inventory_items").insert(payload);
    if (error) throw error;
  }

  const { data: maintenance, error: maintErr } = await supabase.from("maintenance_tasks").select("id").eq("organization_id", organizationId);
  if (maintErr) throw maintErr;
  if (maintenance.length < 12) {
    const payload = Array.from({ length: 12 - maintenance.length }).map((_, i) => ({
      title: `Maintenance Task ${i + 1}`,
      description: "Seeded preventive maintenance",
      status: ["scheduled", "in_progress", "completed"][i % 3],
      equipment_id: devices[i % devices.length]?.id ?? null,
      site_id: sites[i % sites.length]?.id ?? null,
      scheduled_at: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString(),
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("maintenance_tasks").insert(payload);
    if (error) throw error;
  }

  const { data: billing, error: billErr } = await supabase.from("billing_records").select("id").eq("organization_id", organizationId);
  if (billErr) throw billErr;
  if (billing.length < 40) {
    const payload = Array.from({ length: 40 - billing.length }).map((_, i) => ({
      subscriber_id: subscribers[i % subscribers.length].id,
      invoice_number: `INV-${organizationId.slice(0, 6)}-${String(i + 1).padStart(5, "0")}`,
      amount: Number(randomBetween(19, 220).toFixed(2)),
      currency: "USD",
      due_date: new Date(Date.now() + (i + 3) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: i % 5 === 0 ? "overdue" : i % 3 === 0 ? "paid" : "due",
      paid_at: i % 3 === 0 ? new Date(Date.now() - i * 6 * 60 * 60 * 1000).toISOString() : null,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("billing_records").insert(payload);
    if (error) throw error;
  }

  const { data: rfModels, error: rfErr } = await supabase.from("rf_propagation_models").select("id").eq("organization_id", organizationId);
  if (rfErr) throw rfErr;
  if (rfModels.length < 10) {
    const payload = Array.from({ length: 10 - rfModels.length }).map((_, i) => ({
      name: `RF Model ${i + 1}`,
      site_id: sites[i % sites.length].id,
      frequency_mhz: [2400, 3500, 5200, 5800][i % 4],
      tx_power_dbm: 16 + (i % 8),
      antenna_height_m: 20 + (i % 12),
      predicted_radius_km: Number(randomBetween(2, 12).toFixed(2)),
      notes: "Seeded model",
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("rf_propagation_models").insert(payload);
    if (error) throw error;
  }

  const { data: measurements, error: measErr } = await supabase.from("coverage_measurements").select("id").eq("organization_id", organizationId);
  if (measErr) throw measErr;
  if (measurements.length < 120) {
    const payload = Array.from({ length: 120 - measurements.length }).map((_, i) => ({
      site_id: sites[i % sites.length].id,
      latitude: Number((randomBetween(18.5, 19.6)).toFixed(6)),
      longitude: Number((randomBetween(72.6, 73.9)).toFixed(6)),
      signal_strength: Number(randomBetween(-85, -45).toFixed(2)),
      noise_floor: Number(randomBetween(-105, -88).toFixed(2)),
      sinr: Number(randomBetween(8, 34).toFixed(2)),
      collected_at: new Date(Date.now() - i * 15 * 60 * 1000).toISOString(),
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("coverage_measurements").insert(payload);
    if (error) throw error;
  }

  const featureKeys = [
    "ai_network_optimization",
    "dynamic_spectrum_access",
    "edge_computing_integration",
    "fwa_5g_integration",
    "self_healing_networks",
    "blockchain_authentication",
    "weather_adaptive_performance",
    "multi_tenant_network_slicing",
    "predictive_maintenance",
    "zero_touch_provisioning",
    "software_defined_radio",
    "digital_twin_modeling",
    "container_network_functions",
  ];

  const { data: profiles, error: profileErr } = await supabase
    .from("advanced_feature_profiles")
    .select("id,feature_key")
    .eq("organization_id", organizationId);
  if (profileErr) throw profileErr;

  if (profiles.length < featureKeys.length) {
    const existing = new Set(profiles.map((p) => p.feature_key));
    const payload = featureKeys
      .filter((key) => !existing.has(key))
      .map((key) => ({
        feature_key: key,
        name: key.replaceAll("_", " "),
        enabled: false,
        config: {},
        organization_id: organizationId,
      }));
    if (payload.length) {
      const { error } = await supabase.from("advanced_feature_profiles").insert(payload);
      if (error) throw error;
    }
  }

  const { data: runs, error: runsErr } = await supabase.from("advanced_feature_runs").select("id").eq("organization_id", organizationId);
  if (runsErr) throw runsErr;
  if (runs.length < 30) {
    const payload = Array.from({ length: 30 - runs.length }).map((_, i) => ({
      feature_key: featureKeys[i % featureKeys.length],
      status: ["queued", "running", "completed", "failed"][i % 4],
      input: { sample: true, window: "24h", index: i + 1 },
      result: i % 4 === 2 ? { improved_metric: "latency", delta_percent: Number(randomBetween(1, 11).toFixed(2)) } : null,
      started_at: new Date(Date.now() - (i + 2) * 60 * 60 * 1000).toISOString(),
      finished_at: i % 4 === 2 ? new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString() : null,
      organization_id: organizationId,
    }));
    const { error } = await supabase.from("advanced_feature_runs").insert(payload);
    if (error) throw error;
  }
}

async function ensureVendorProvisioning(organizationId: string, devices: { id: string; model: string; vendor?: string | null }[]) {
  const profileDefs = [
    { name: "Cambium ePMP Baseline", vendor: "cambium", model_pattern: "ePMP", transport: "https" },
    { name: "MikroTik RouterOS Baseline", vendor: "mikrotik", model_pattern: "MikroTik", transport: "ssh" },
  ];

  const { data: profiles, error: profileError } = await supabase
    .from("vendor_device_profiles")
    .select("id,name")
    .eq("organization_id", organizationId)
    .in("name", profileDefs.map((d) => d.name));
  if (profileError) throw profileError;

  const names = new Set(profiles.map((p) => p.name));
  const toInsert = profileDefs
    .filter((d) => !names.has(d.name))
    .map((d) => ({ ...d, config_template: {}, enabled: true, organization_id: organizationId }));
  if (toInsert.length) {
    const { error } = await supabase.from("vendor_device_profiles").insert(toInsert);
    if (error) throw error;
  }

  const { data: profileRows, error: profileRowsError } = await supabase
    .from("vendor_device_profiles")
    .select("id,vendor")
    .eq("organization_id", organizationId);
  if (profileRowsError) throw profileRowsError;

  const { data: jobs, error: jobsError } = await supabase
    .from("provisioning_jobs")
    .select("id")
    .eq("organization_id", organizationId);
  if (jobsError) throw jobsError;

  if (jobs.length < 18 && profileRows.length) {
    const payload = Array.from({ length: 18 - jobs.length }).map((_, i) => {
      const device = devices[i % devices.length];
      const profile = profileRows[i % profileRows.length];
      return {
        equipment_id: device.id,
        profile_id: profile.id,
        vendor: profile.vendor,
        mode: ["provision", "backup", "diagnostic"][i % 3],
        status: ["completed", "running", "failed", "queued"][i % 4],
        request_payload: { seed: true, index: i + 1 },
        result_payload: i % 4 === 0 ? { ok: true } : null,
        error_message: i % 4 === 2 ? "Seeded job failure" : null,
        started_at: new Date(Date.now() - (i + 2) * 60 * 60 * 1000).toISOString(),
        finished_at: i % 4 === 0 ? new Date(Date.now() - (i + 1) * 60 * 60 * 1000).toISOString() : null,
        organization_id: organizationId,
      };
    });
    const { error } = await supabase.from("provisioning_jobs").insert(payload);
    if (error) throw error;
  }
}

async function main() {
  const organizationId = await ensureOwnerOrgId();

  const plans = await ensureServicePlans(organizationId);
  const sites = await ensureSites(organizationId);
  const equipment = await ensureEquipment(organizationId, sites);
  const subscribers = await ensureSubscribers(organizationId, plans, sites);
  await ensureMetrics(organizationId, equipment);

  const networks = await ensureNetworks(organizationId, sites);
  const links = await ensureWirelessLinks(organizationId, networks, sites);
  await ensurePtmp(organizationId, sites, subscribers);
  await ensureSpectrumAllocations(organizationId, sites, equipment);
  await ensureQos(organizationId, subscribers);
  await ensureFailover(organizationId, networks, links);
  await ensureSecurityCoverageGuest(organizationId, sites);
  await ensureConfigAndFirmware(organizationId, equipment);
  await ensureLoadBalancingAndMesh(organizationId, links, equipment);
  await ensureIntegrationsSnmpTrafficMobile(organizationId, subscribers, sites, plans, equipment);
  await ensureEquipmentHealthSnapshots(organizationId, equipment);
  await ensureBlueprintExpansion(organizationId, sites, equipment, subscribers);
  await ensureVendorProvisioning(organizationId, equipment);

  console.log("Seed complete (expanded, idempotent): base + 17 core modules + depth workflows + blueprint expansion populated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
