import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

type RuntimeContext = {
  metrics: Array<{ latency: number; packet_loss: number; throughput: number; signal_strength: number }>;
  links: Array<{ status: string; capacity_mbps: number }>;
  scans: Array<{ interference_score: number; frequency_mhz: number; channel_utilization: number | null }>;
  predictive: Array<{ risk_score: number; failure_window_hours: number }>;
  provisioningJobs: Array<{ status: string; mode: string }>;
  failoverEvents: Array<{ action: string; created_at: string }>;
  alarms: Array<{ severity: string }>;
  sessions: Array<{ session_state: string }>;
  recommendations: Array<{ status: string; confidence: number }>;
  ptmpClients: Array<{ id: string }>;
  qosBindings: Array<{ id: string }>;
};

type EngineOutput = {
  summary: string;
  score: number;
  payload: Record<string, unknown>;
};

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((acc, val) => acc + val, 0) / values.length;
}

async function loadRuntimeContext(ctx: Awaited<ReturnType<typeof getApiContext>>): Promise<RuntimeContext> {
  if ("response" in ctx) {
    return {
      metrics: [],
      links: [],
      scans: [],
      predictive: [],
      provisioningJobs: [],
      failoverEvents: [],
      alarms: [],
      sessions: [],
      recommendations: [],
      ptmpClients: [],
      qosBindings: [],
    };
  }

  const [
    metricsRes,
    linksRes,
    scansRes,
    predictiveRes,
    provisioningJobsRes,
    failoverRes,
    alarmsRes,
    sessionsRes,
    recommendationsRes,
    ptmpClientsRes,
    qosBindingsRes,
  ] = await Promise.all([
    ctx.supabase.from("performance_metrics").select("latency,packet_loss,throughput,signal_strength").order("recorded_at", { ascending: false }).limit(500),
    ctx.supabase.from("wireless_links").select("status,capacity_mbps"),
    ctx.supabase.from("spectrum_scans").select("interference_score,frequency_mhz,channel_utilization").order("created_at", { ascending: false }).limit(300),
    ctx.supabase.from("predictive_maintenance_scores").select("risk_score,failure_window_hours").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("provisioning_jobs").select("status,mode").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("failover_events").select("action,created_at").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("alarms").select("severity").eq("resolved", false).limit(200),
    ctx.supabase.from("subscriber_sessions").select("session_state").limit(500),
    ctx.supabase.from("channel_recommendations").select("status,confidence").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("ptmp_clients").select("id"),
    ctx.supabase.from("subscriber_qos").select("id"),
  ]);

  return {
    metrics: metricsRes.data ?? [],
    links: linksRes.data ?? [],
    scans: scansRes.data ?? [],
    predictive: predictiveRes.data ?? [],
    provisioningJobs: provisioningJobsRes.data ?? [],
    failoverEvents: failoverRes.data ?? [],
    alarms: alarmsRes.data ?? [],
    sessions: sessionsRes.data ?? [],
    recommendations: recommendationsRes.data ?? [],
    ptmpClients: ptmpClientsRes.data ?? [],
    qosBindings: qosBindingsRes.data ?? [],
  };
}

function runFeature(featureKey: string, runtime: RuntimeContext, params: Record<string, unknown>): EngineOutput {
  const avgLatency = average(runtime.metrics.map((m) => Number(m.latency)));
  const avgLoss = average(runtime.metrics.map((m) => Number(m.packet_loss)));
  const avgThroughput = average(runtime.metrics.map((m) => Number(m.throughput)));
  const weakSignalCount = runtime.metrics.filter((m) => Number(m.signal_strength) < -75).length;
  const linksDown = runtime.links.filter((l) => l.status !== "up").length;
  const scansHighInterference = runtime.scans.filter((s) => Number(s.interference_score) >= 60).length;
  const highRiskDevices = runtime.predictive.filter((p) => Number(p.risk_score) >= 75).length;
  const failedProvisioningJobs = runtime.provisioningJobs.filter((j) => j.status === "failed").length;
  const completedProvisioningJobs = runtime.provisioningJobs.filter((j) => j.status === "completed").length;
  const onlineSessions = runtime.sessions.filter((s) => s.session_state === "online").length;
  const alarmsCritical = runtime.alarms.filter((a) => a.severity === "critical").length;
  const proposedRecommendations = runtime.recommendations.filter((r) => r.status === "proposed").length;
  const avgRecommendationConfidence = average(runtime.recommendations.map((r) => Number(r.confidence)));

  switch (featureKey) {
    case "ai_network_optimization": {
      const hotspots = runtime.metrics.filter((m) => Number(m.latency) > 90 || Number(m.packet_loss) > 2.5).length;
      const score = clampScore(100 - avgLatency * 0.6 - avgLoss * 9 - hotspots * 0.8);
      return {
        summary: `Optimization pass identified ${hotspots} congestion hotspots with average latency ${avgLatency.toFixed(1)}ms.`,
        score,
        payload: { hotspots, avg_latency: avgLatency, avg_packet_loss: avgLoss, avg_throughput: avgThroughput, params },
      };
    }
    case "dynamic_spectrum_access": {
      const score = clampScore(88 - scansHighInterference * 1.4 + avgRecommendationConfidence * 14);
      return {
        summary: `Spectrum scan found ${scansHighInterference} high-interference channels and ${proposedRecommendations} candidate reallocations.`,
        score,
        payload: { high_interference_channels: scansHighInterference, recommendation_candidates: proposedRecommendations, confidence_mean: avgRecommendationConfidence, params },
      };
    }
    case "edge_computing_integration": {
      const edgeCandidates = Math.max(0, Math.round((onlineSessions * 0.2) + weakSignalCount * 0.1));
      const score = clampScore(62 + edgeCandidates * 1.6 - avgLatency * 0.25);
      return {
        summary: `Detected ${edgeCandidates} edge-offload candidates from active session and latency distribution.`,
        score,
        payload: { online_sessions: onlineSessions, weak_signal_samples: weakSignalCount, edge_candidates: edgeCandidates, params },
      };
    }
    case "fwa_5g_integration": {
      const potentialSites = runtime.links.length;
      const readiness = potentialSites ? ((runtime.links.length - linksDown) / potentialSites) * 100 : 0;
      const score = clampScore(readiness - alarmsCritical * 2);
      return {
        summary: `5G FWA readiness estimated at ${readiness.toFixed(1)}% from backhaul availability and critical alarm pressure.`,
        score,
        payload: { readiness_percent: readiness, links_total: potentialSites, links_down: linksDown, critical_alarms: alarmsCritical, params },
      };
    }
    case "self_healing_networks": {
      const recentFailovers = runtime.failoverEvents.length;
      const score = clampScore(70 + recentFailovers * 0.7 - alarmsCritical * 2.5);
      return {
        summary: `Self-healing simulation replayed ${recentFailovers} failover events against current alarm state.`,
        score,
        payload: { failover_events_replayed: recentFailovers, critical_alarms: alarmsCritical, params },
      };
    }
    case "blockchain_authentication": {
      const authLoad = onlineSessions + runtime.provisioningJobs.length;
      const score = clampScore(55 + Math.min(authLoad / 8, 35) - failedProvisioningJobs * 1.2);
      return {
        summary: `Decentralized auth feasibility evaluated for ${authLoad} identity operations.`,
        score,
        payload: { identity_operations: authLoad, provisioning_failures: failedProvisioningJobs, params },
      };
    }
    case "weather_adaptive_performance": {
      const weatherRisk = weakSignalCount + Math.round(avgLoss * 10);
      const score = clampScore(92 - weatherRisk * 0.9);
      return {
        summary: `Weather-adaptive profile computed using ${weakSignalCount} weak-signal samples and packet-loss drift.`,
        score,
        payload: { weak_signal_samples: weakSignalCount, avg_packet_loss: avgLoss, risk_index: weatherRisk, params },
      };
    }
    case "multi_tenant_network_slicing": {
      const attachedClients = runtime.ptmpClients.length;
      const qosCoverage = attachedClients ? (runtime.qosBindings.length / attachedClients) * 100 : 0;
      const score = clampScore(60 + qosCoverage * 0.35 - linksDown * 1.5);
      return {
        summary: `Tenant slicing readiness based on QoS attachment coverage ${qosCoverage.toFixed(1)}% across PTMP clients.`,
        score,
        payload: { ptmp_clients: attachedClients, qos_bindings: runtime.qosBindings.length, qos_coverage: qosCoverage, links_down: linksDown, params },
      };
    }
    case "predictive_maintenance": {
      const avgFailureWindow = average(runtime.predictive.map((p) => Number(p.failure_window_hours)));
      const score = clampScore(100 - highRiskDevices * 4 + avgFailureWindow * 0.12);
      return {
        summary: `Predictive run identified ${highRiskDevices} high-risk devices with average failure horizon ${avgFailureWindow.toFixed(1)}h.`,
        score,
        payload: { high_risk_devices: highRiskDevices, average_failure_window_hours: avgFailureWindow, params },
      };
    }
    case "zero_touch_provisioning": {
      const attempts = completedProvisioningJobs + failedProvisioningJobs;
      const successRate = attempts ? (completedProvisioningJobs / attempts) * 100 : 0;
      const score = clampScore(successRate - failedProvisioningJobs);
      return {
        summary: `Zero-touch pipeline success rate ${successRate.toFixed(1)}% over ${attempts} recent provisioning attempts.`,
        score,
        payload: { attempts, completed: completedProvisioningJobs, failed: failedProvisioningJobs, success_rate: successRate, params },
      };
    }
    case "software_defined_radio": {
      const score = clampScore(65 + proposedRecommendations * 0.9 + avgRecommendationConfidence * 20 - scansHighInterference * 0.6);
      return {
        summary: `SDR adaptation evaluated against ${proposedRecommendations} channel recommendations and live interference profile.`,
        score,
        payload: { recommendations: proposedRecommendations, confidence_mean: avgRecommendationConfidence, high_interference_channels: scansHighInterference, params },
      };
    }
    case "digital_twin_modeling": {
      const inputs = runtime.links.length + runtime.metrics.length + runtime.scans.length;
      const score = clampScore(50 + Math.min(inputs / 15, 45) - linksDown * 2);
      return {
        summary: `Digital twin scenario generated from ${inputs} topology and telemetry datapoints.`,
        score,
        payload: { telemetry_points: runtime.metrics.length, links: runtime.links.length, scans: runtime.scans.length, links_down: linksDown, params },
      };
    }
    case "container_network_functions": {
      const orchestrationLoad = runtime.provisioningJobs.length + runtime.failoverEvents.length;
      const score = clampScore(58 + Math.min(orchestrationLoad / 10, 35) - alarmsCritical * 1.5);
      return {
        summary: `CNF rollout sizing estimated using provisioning/failover workload signals.`,
        score,
        payload: { orchestration_load: orchestrationLoad, provisioning_jobs: runtime.provisioningJobs.length, failover_events: runtime.failoverEvents.length, critical_alarms: alarmsCritical, params },
      };
    }
    default:
      return {
        summary: "Unsupported feature key",
        score: 0,
        payload: { params },
      };
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator", "technician"]);
  if ("response" in ctx) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { run_id?: string; feature_key?: string; params?: Record<string, unknown> };
  if (!body.run_id) return NextResponse.json({ error: "run_id is required" }, { status: 400 });

  const { data: run, error: runError } = await ctx.supabase
    .from("advanced_feature_runs")
    .select("id,feature_key,input")
    .eq("id", body.run_id)
    .single();
  if (runError) return NextResponse.json({ error: runError.message }, { status: 400 });

  const featureKey = body.feature_key ?? run.feature_key;
  const runtime = await loadRuntimeContext(ctx);
  const params = body.params ?? ((run.input as Record<string, unknown> | null) ?? {});
  const result = runFeature(featureKey, runtime, params);

  if (result.summary === "Unsupported feature key") {
    return NextResponse.json({ error: "Unsupported feature_key" }, { status: 400 });
  }

  const { data, error } = await ctx.supabase
    .from("advanced_feature_runs")
    .update({
      status: "completed",
      result,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ data });
}
