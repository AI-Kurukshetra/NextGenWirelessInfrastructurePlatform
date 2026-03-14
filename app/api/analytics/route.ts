import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [metricsRes, subscribersRes] = await Promise.all([
    ctx.supabase.from("performance_metrics").select("throughput,latency,packet_loss").limit(1000),
    ctx.supabase.from("subscribers").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  if (metricsRes.error) return NextResponse.json({ error: metricsRes.error.message }, { status: 400 });
  if (subscribersRes.error) return NextResponse.json({ error: subscribersRes.error.message }, { status: 400 });

  const metrics = metricsRes.data ?? [];
  const count = Math.max(metrics.length, 1);
  const avgThroughput = Math.round(metrics.reduce((s, m) => s + Number(m.throughput), 0) / count);
  const avgLatency = Number((metrics.reduce((s, m) => s + Number(m.latency), 0) / count).toFixed(2));
  const avgPacketLoss = Number((metrics.reduce((s, m) => s + Number(m.packet_loss), 0) / count).toFixed(2));

  return NextResponse.json({
    data: {
      avg_throughput: avgThroughput,
      avg_latency: avgLatency,
      avg_packet_loss: avgPacketLoss,
      active_subscribers: subscribersRes.count ?? 0,
    },
  });
}
