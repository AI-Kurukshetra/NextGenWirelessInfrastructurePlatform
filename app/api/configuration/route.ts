import { NextRequest, NextResponse } from "next/server";
import { getApiContext, handleTablePost } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [backups, campaigns] = await Promise.all([
    ctx.supabase.from("device_config_backups").select("*").order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("firmware_campaigns").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if (backups.error) return NextResponse.json({ error: backups.error.message }, { status: 400 });
  if (campaigns.error) return NextResponse.json({ error: campaigns.error.message }, { status: 400 });

  return NextResponse.json({ data: { backups: backups.data ?? [], campaigns: campaigns.data ?? [] } });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const target = String(payload.target ?? "backup");
  const body = { ...payload } as Record<string, unknown>;
  delete body.target;

  if (target === "campaign") return handleTablePost("firmware_campaigns", body);
  return handleTablePost("device_config_backups", body);
}
