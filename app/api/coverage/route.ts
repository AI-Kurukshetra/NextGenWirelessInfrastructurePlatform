import { NextRequest, NextResponse } from "next/server";
import { getApiContext, handleTablePost } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [zones, models, measurements] = await Promise.all([
    ctx.supabase.from("coverage_zones").select("*").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("rf_propagation_models").select("*").order("created_at", { ascending: false }).limit(200),
    ctx.supabase.from("coverage_measurements").select("*").order("collected_at", { ascending: false }).limit(500),
  ]);

  if (zones.error) return NextResponse.json({ error: zones.error.message }, { status: 400 });
  if (models.error) return NextResponse.json({ error: models.error.message }, { status: 400 });
  if (measurements.error) return NextResponse.json({ error: measurements.error.message }, { status: 400 });

  return NextResponse.json({ data: { zones: zones.data ?? [], propagation_models: models.data ?? [], measurements: measurements.data ?? [] } });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const target = String(payload.target ?? "zone");
  const body = { ...payload } as Record<string, unknown>;
  delete body.target;

  if (target === "propagation") return handleTablePost("rf_propagation_models", body);
  if (target === "measurement") return handleTablePost("coverage_measurements", body);
  return handleTablePost("coverage_zones", body);
}
