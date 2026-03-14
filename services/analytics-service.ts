import { getSupabaseBrowserClient } from "@/lib/supabase";

export interface ThroughputTrendPoint {
  day: string;
  throughput: number;
}

export interface SubscriberGrowthPoint {
  day: string;
  subscribers: number;
}

export interface UptimePoint {
  day: string;
  uptime: number;
}

export interface AnalyticsSummary {
  avgThroughput: number;
  avgLatency: number;
  avgPacketLoss: number;
  activeSubscribers: number;
}

export interface ProblemDevice {
  equipment_id: string;
  avg_latency: number;
  avg_packet_loss: number;
  samples: number;
}

export interface BusinessOpsMetrics {
  monthlyRecurringRevenue: number;
  avgTicketResolutionHours: number;
  spectrumEfficiency: number;
  coverageAreaPerSiteKm2: number;
  equipmentFailureRate: number;
  avgInstallTimeHours: number;
  customerAcquisitionCostEstimate: number;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export async function getThroughputTrends(days = 14): Promise<ThroughputTrendPoint[]> {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("performance_metrics")
    .select("recorded_at, throughput")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) throw error;

  const grouped = new Map<string, { total: number; count: number }>();
  for (const row of data) {
    const key = new Date(row.recorded_at).toLocaleDateString();
    const current = grouped.get(key) ?? { total: 0, count: 0 };
    current.total += Number(row.throughput);
    current.count += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([day, value]) => ({
    day,
    throughput: Math.round(value.total / Math.max(value.count, 1)),
  }));
}

export async function getSubscriberGrowth(days = 14): Promise<SubscriberGrowthPoint[]> {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("subscribers")
    .select("created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const byDay = new Map<string, number>();
  let cumulative = 0;

  data.forEach((row) => {
    const day = new Date(row.created_at).toLocaleDateString();
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  });

  return Array.from(byDay.entries()).map(([day, count]) => {
    cumulative += count;
    return { day, subscribers: cumulative };
  });
}

export async function getNetworkUptime(days = 14): Promise<UptimePoint[]> {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("equipment").select("status,last_seen").gte("last_seen", since);

  if (error) throw error;

  const now = Date.now();
  const byDay = new Map<string, { up: number; total: number }>();

  data.forEach((item) => {
    const day = new Date(item.last_seen).toLocaleDateString();
    const entry = byDay.get(day) ?? { up: 0, total: 0 };
    entry.total += 1;
    if (item.status === "online" && now - new Date(item.last_seen).getTime() <= 60 * 60 * 1000) {
      entry.up += 1;
    }
    byDay.set(day, entry);
  });

  return Array.from(byDay.entries()).map(([day, value]) => ({
    day,
    uptime: value.total === 0 ? 0 : Math.round((value.up / value.total) * 100),
  }));
}

export async function getAnalyticsSummary(days = 14): Promise<AnalyticsSummary> {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [metrics, subscribers] = await Promise.all([
    supabase
      .from("performance_metrics")
      .select("throughput,latency,packet_loss")
      .gte("recorded_at", since),
    supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (metrics.error) throw metrics.error;
  if (subscribers.error) throw subscribers.error;

  const count = metrics.data.length || 1;
  const avgThroughput = Math.round(metrics.data.reduce((sum, r) => sum + Number(r.throughput), 0) / count);
  const avgLatency = Number((metrics.data.reduce((sum, r) => sum + Number(r.latency), 0) / count).toFixed(2));
  const avgPacketLoss = Number((metrics.data.reduce((sum, r) => sum + Number(r.packet_loss), 0) / count).toFixed(2));

  return {
    avgThroughput,
    avgLatency,
    avgPacketLoss,
    activeSubscribers: subscribers.count ?? 0,
  };
}

export async function getLatencyPercentiles(days = 14) {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("performance_metrics")
    .select("latency")
    .gte("recorded_at", since)
    .order("latency", { ascending: true });
  if (error) throw error;
  const vals = data.map((d) => Number(d.latency));
  if (!vals.length) return { p50: 0, p90: 0, p99: 0 };
  const at = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
  return { p50: at(0.5), p90: at(0.9), p99: at(0.99) };
}

export async function getTopProblemDevices(days = 14, limit = 5): Promise<ProblemDevice[]> {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("performance_metrics")
    .select("equipment_id,latency,packet_loss")
    .gte("recorded_at", since);
  if (error) throw error;

  const grouped = new Map<string, { lat: number; loss: number; count: number }>();
  for (const row of data) {
    const g = grouped.get(row.equipment_id) ?? { lat: 0, loss: 0, count: 0 };
    g.lat += Number(row.latency);
    g.loss += Number(row.packet_loss);
    g.count += 1;
    grouped.set(row.equipment_id, g);
  }

  return Array.from(grouped.entries())
    .map(([equipment_id, g]) => ({
      equipment_id,
      avg_latency: Number((g.lat / g.count).toFixed(2)),
      avg_packet_loss: Number((g.loss / g.count).toFixed(2)),
      samples: g.count,
    }))
    .sort((a, b) => b.avg_latency + b.avg_packet_loss * 30 - (a.avg_latency + a.avg_packet_loss * 30))
    .slice(0, limit);
}

export async function getBusinessOpsMetrics(days = 30): Promise<BusinessOpsMetrics> {
  const supabase = getSupabaseBrowserClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [billing, tickets, scans, zones, equipment, installs] = await Promise.all([
    supabase
      .from("billing_records")
      .select("amount,status,due_date")
      .gte("due_date", monthStart.toISOString().slice(0, 10))
      .in("status", ["due", "paid"]),
    supabase
      .from("tickets")
      .select("created_at,resolved_at,status")
      .eq("status", "resolved")
      .not("resolved_at", "is", null)
      .gte("created_at", since),
    supabase
      .from("spectrum_scans")
      .select("interference_score,channel_utilization")
      .gte("created_at", since),
    supabase
      .from("coverage_zones")
      .select("radius_km,site_id")
      .not("radius_km", "is", null),
    supabase
      .from("equipment")
      .select("status")
      .in("status", ["online", "offline", "warning", "maintenance"]),
    supabase
      .from("maintenance_tasks")
      .select("title,created_at,completed_at,status")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("created_at", since),
  ]);

  if (billing.error) throw billing.error;
  if (tickets.error) throw tickets.error;
  if (scans.error) throw scans.error;
  if (zones.error) throw zones.error;
  if (equipment.error) throw equipment.error;
  if (installs.error) throw installs.error;

  const monthlyRecurringRevenue = (billing.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  const resolutionHours = (tickets.data ?? []).map((ticket) => {
    const started = new Date(ticket.created_at).getTime();
    const ended = ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : started;
    return Math.max(0, (ended - started) / 3_600_000);
  });
  const avgTicketResolutionHours = Number(average(resolutionHours).toFixed(2));

  const scanScores = (scans.data ?? []).map((scan) => {
    const interference = Number(scan.interference_score ?? 0);
    const utilization = Number(scan.channel_utilization ?? 50);
    const cleanliness = Math.max(0, 100 - interference);
    return Math.max(0, Math.min(100, cleanliness * 0.6 + utilization * 0.4));
  });
  const spectrumEfficiency = Number(average(scanScores).toFixed(2));

  const zoneRows = zones.data ?? [];
  const totalArea = zoneRows.reduce((sum, zone) => {
    const radius = Number(zone.radius_km ?? 0);
    return sum + Math.PI * radius * radius;
  }, 0);
  const uniqueSiteCount = new Set(zoneRows.map((zone) => zone.site_id).filter(Boolean)).size || 1;
  const coverageAreaPerSiteKm2 = Number((totalArea / uniqueSiteCount).toFixed(2));

  const equipmentRows = equipment.data ?? [];
  const failureCount = equipmentRows.filter((row) => row.status === "offline" || row.status === "warning").length;
  const equipmentFailureRate = Number(((failureCount / Math.max(equipmentRows.length, 1)) * 100).toFixed(2));

  const installRows = (installs.data ?? []).filter((task) => /install|provision|deploy/i.test(String(task.title ?? "")));
  const installHours = installRows.map((task) => {
    const started = new Date(task.created_at).getTime();
    const ended = task.completed_at ? new Date(task.completed_at).getTime() : started;
    return Math.max(0, (ended - started) / 3_600_000);
  });
  const avgInstallTimeHours = Number(average(installHours).toFixed(2));

  const laborRatePerHour = 45;
  const customerAcquisitionCostEstimate = Number((avgInstallTimeHours * laborRatePerHour + avgTicketResolutionHours * 12).toFixed(2));

  return {
    monthlyRecurringRevenue: Number(monthlyRecurringRevenue.toFixed(2)),
    avgTicketResolutionHours,
    spectrumEfficiency,
    coverageAreaPerSiteKm2,
    equipmentFailureRate,
    avgInstallTimeHours,
    customerAcquisitionCostEstimate,
  };
}
