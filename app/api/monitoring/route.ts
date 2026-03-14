import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [metrics, alarms, health] = await Promise.all([
    ctx.supabase.from("performance_metrics").select("*").order("recorded_at", { ascending: false }).limit(100),
    ctx.supabase.from("alarms").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(50),
    ctx.supabase.from("equipment_health_snapshots").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if (metrics.error) return NextResponse.json({ error: metrics.error.message }, { status: 400 });
  if (alarms.error) return NextResponse.json({ error: alarms.error.message }, { status: 400 });
  if (health.error) return NextResponse.json({ error: health.error.message }, { status: 400 });

  return NextResponse.json({
    data: {
      metrics: metrics.data ?? [],
      alarms: alarms.data ?? [],
      equipment_health: health.data ?? [],
    },
  });
}
