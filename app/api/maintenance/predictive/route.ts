import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

function recommendationForScore(score: number) {
  if (score >= 80) return "Immediate maintenance window and hardware inspection recommended";
  if (score >= 60) return "Schedule preventive visit within 48 hours";
  if (score >= 40) return "Monitor closely and run diagnostics";
  return "No immediate action required";
}

export async function POST() {
  const ctx = await getApiContext(["admin", "operator", "technician"]);
  if ("response" in ctx) return ctx.response;

  const { data: equipment, error } = await ctx.supabase
    .from("equipment")
    .select("id,status,temperature,last_seen");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: latestMetrics } = await ctx.supabase
    .from("performance_metrics")
    .select("equipment_id,latency,packet_loss,signal_strength")
    .order("recorded_at", { ascending: false })
    .limit(400);

  const metricsByEq = new Map<string, Array<{ latency: number; packet_loss: number; signal_strength: number }>>();
  for (const row of latestMetrics ?? []) {
    const current = metricsByEq.get(row.equipment_id) ?? [];
    current.push({ latency: Number(row.latency), packet_loss: Number(row.packet_loss), signal_strength: Number(row.signal_strength) });
    metricsByEq.set(row.equipment_id, current);
  }

  const inserted = [] as Array<{ equipment_id: string; risk_score: number }>;
  for (const eq of equipment ?? []) {
    const rows = metricsByEq.get(eq.id) ?? [];
    const avgLatency = rows.length ? rows.reduce((s, r) => s + r.latency, 0) / rows.length : 0;
    const avgLoss = rows.length ? rows.reduce((s, r) => s + r.packet_loss, 0) / rows.length : 0;
    const avgSignal = rows.length ? rows.reduce((s, r) => s + r.signal_strength, 0) / rows.length : -65;

    let score = 0;
    if (eq.status !== "online") score += 35;
    if (Number(eq.temperature) > 70) score += 25;
    else if (Number(eq.temperature) > 60) score += 12;
    if (avgLatency > 120) score += 20;
    else if (avgLatency > 80) score += 12;
    if (avgLoss > 3) score += 18;
    else if (avgLoss > 1) score += 9;
    if (avgSignal < -75) score += 12;

    const riskScore = Math.max(0, Math.min(100, Math.round(score)));
    const recommendation = recommendationForScore(riskScore);

    await ctx.supabase.from("predictive_maintenance_scores").insert({
      equipment_id: eq.id,
      risk_score: riskScore,
      failure_window_hours: riskScore >= 80 ? 24 : riskScore >= 60 ? 72 : 168,
      recommendation,
      factors: {
        avg_latency: Number(avgLatency.toFixed(2)),
        avg_packet_loss: Number(avgLoss.toFixed(2)),
        avg_signal_strength: Number(avgSignal.toFixed(2)),
        temperature: eq.temperature,
        status: eq.status,
      },
    });

    inserted.push({ equipment_id: eq.id, risk_score: riskScore });
  }

  return NextResponse.json({ data: inserted });
}
