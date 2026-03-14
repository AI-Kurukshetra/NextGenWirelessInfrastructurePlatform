import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator", "technician"]);
  if ("response" in ctx) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { site_id?: string; equipment_id?: string };

  const query = ctx.supabase
    .from("spectrum_allocations")
    .select("id,site_id,equipment_id,frequency_mhz,noise_floor_dbm")
    .order("created_at", { ascending: false })
    .limit(50);

  if (body.site_id) query.eq("site_id", body.site_id);
  if (body.equipment_id) query.eq("equipment_id", body.equipment_id);

  const { data: allocations, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const recommendations = [] as Array<{ current: number | null; recommended: number; reason: string; equipment_id: string | null; site_id: string | null }>;
  for (const alloc of allocations ?? []) {
    const current = Number(alloc.frequency_mhz);
    const recommend = current < 5700 ? 5785 : current > 5900 ? 5860 : current + 20;
    const reason = Number(alloc.noise_floor_dbm ?? -95) > -85
      ? "High noise floor detected, suggest cleaner channel"
      : "Balancing channel spacing to reduce co-channel interference";

    recommendations.push({
      current,
      recommended: recommend,
      reason,
      equipment_id: alloc.equipment_id,
      site_id: alloc.site_id,
    });

    await ctx.supabase.from("channel_recommendations").insert({
      site_id: alloc.site_id,
      equipment_id: alloc.equipment_id,
      current_frequency_mhz: current,
      recommended_frequency_mhz: recommend,
      reason,
      confidence: 0.7,
      status: "proposed",
    });

    await ctx.supabase.from("spectrum_scans").insert({
      site_id: alloc.site_id,
      equipment_id: alloc.equipment_id,
      frequency_mhz: current,
      noise_floor_dbm: alloc.noise_floor_dbm,
      interference_score: Number(alloc.noise_floor_dbm ?? -95) > -85 ? 0.8 : 0.3,
      channel_utilization: 0.55,
    });
  }

  return NextResponse.json({ data: recommendations });
}
