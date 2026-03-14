import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { DashboardSummary, PerformanceMetric } from "@/types";

export interface ChartPoint {
  time: string;
  throughput: number;
  latency: number;
  packetLoss: number;
}

export interface LiveEvent {
  id: string;
  type: "metric" | "alarm" | "failover";
  message: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  timestamp: string;
}

export interface DashboardOpsSummary {
  totalNetworks: number;
  p2pLinksUp: number;
  p2pLinksTotal: number;
  failoverEvents24h: number;
  firmwareCompliance: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = getSupabaseBrowserClient();

  const [sites, subscribers, equipment, alerts] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }),
    supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("equipment").select("id,status"),
    supabase.from("alarms").select("id", { count: "exact", head: true }).eq("resolved", false),
  ]);

  if (sites.error) throw sites.error;
  if (subscribers.error) throw subscribers.error;
  if (equipment.error) throw equipment.error;
  if (alerts.error) throw alerts.error;

  const totalEquipment = equipment.data.length;
  const onlineEquipment = equipment.data.filter((eq) => eq.status === "online").length;
  const networkHealth = totalEquipment === 0 ? 0 : Math.round((onlineEquipment / totalEquipment) * 100);

  return {
    networkHealth,
    activeSites: sites.count ?? 0,
    connectedSubscribers: subscribers.count ?? 0,
    onlineEquipment,
    totalEquipment,
    alertCount: alerts.count ?? 0,
  };
}

export async function getRecentMetrics(limit = 24): Promise<ChartPoint[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("performance_metrics")
    .select("recorded_at, throughput, latency, packet_loss")
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data as Pick<PerformanceMetric, "recorded_at" | "throughput" | "latency" | "packet_loss">[])
    .reverse()
    .map((point) => ({
      time: new Date(point.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      throughput: Number(point.throughput),
      latency: Number(point.latency),
      packetLoss: Number(point.packet_loss),
    }));
}

export async function getDashboardOpsSummary(): Promise<DashboardOpsSummary> {
  const supabase = getSupabaseBrowserClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [networks, links, failovers, equipment, campaigns] = await Promise.all([
    supabase.from("networks").select("id", { count: "exact", head: true }),
    supabase.from("wireless_links").select("id,status"),
    supabase.from("failover_events").select("id", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("equipment").select("id,firmware_version"),
    supabase.from("firmware_campaigns").select("firmware_version,status").eq("status", "completed").order("created_at", { ascending: false }).limit(1),
  ]);

  if (networks.error) throw networks.error;
  if (links.error) throw links.error;
  if (failovers.error) throw failovers.error;
  if (equipment.error) throw equipment.error;
  if (campaigns.error) throw campaigns.error;

  const p2pLinksTotal = links.data.length;
  const p2pLinksUp = links.data.filter((l) => l.status === "up").length;
  const latestFirmware = campaigns.data[0]?.firmware_version;
  const firmwareCompliance =
    !latestFirmware || equipment.data.length === 0
      ? 0
      : Math.round((equipment.data.filter((e) => e.firmware_version === latestFirmware).length / equipment.data.length) * 100);

  return {
    totalNetworks: networks.count ?? 0,
    p2pLinksUp,
    p2pLinksTotal,
    failoverEvents24h: failovers.count ?? 0,
    firmwareCompliance,
  };
}

export async function getLiveEvents(limit = 25): Promise<LiveEvent[]> {
  const supabase = getSupabaseBrowserClient();
  const [metrics, alarms, failovers] = await Promise.all([
    supabase.from("performance_metrics").select("id,equipment_id,latency,packet_loss,recorded_at").order("recorded_at", { ascending: false }).limit(limit),
    supabase.from("alarms").select("id,message,severity,created_at").order("created_at", { ascending: false }).limit(limit),
    supabase.from("failover_events").select("id,action,details,created_at").order("created_at", { ascending: false }).limit(limit),
  ]);

  if (metrics.error) throw metrics.error;
  if (alarms.error) throw alarms.error;
  if (failovers.error) throw failovers.error;

  const merged: LiveEvent[] = [
    ...metrics.data.map((m) => ({
      id: `m-${m.id}`,
      type: "metric" as const,
      message: `Metric: eq=${m.equipment_id} latency=${m.latency}ms loss=${m.packet_loss}%`,
      severity: (m.latency > 100 || m.packet_loss > 3 ? "high" : "info") as LiveEvent["severity"],
      timestamp: m.recorded_at,
    })),
    ...alarms.data.map((a) => ({
      id: `a-${a.id}`,
      type: "alarm" as const,
      message: a.message,
      severity: (a.severity ?? "medium") as LiveEvent["severity"],
      timestamp: a.created_at,
    })),
    ...failovers.data.map((f) => ({
      id: `f-${f.id}`,
      type: "failover" as const,
      message: `${f.action}: ${f.details ?? "n/a"}`,
      severity: "high" as const,
      timestamp: f.created_at,
    })),
  ];

  return merged
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
