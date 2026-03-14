import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const { data, error } = await ctx.supabase
    .from("alarms")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator"]);
  if ("response" in ctx) return ctx.response;

  const payload = (await request.json()) as { alarm_id?: string; resolved?: boolean };
  if (!payload.alarm_id) return NextResponse.json({ error: "alarm_id required" }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("alarms")
    .update({ resolved: payload.resolved ?? true })
    .eq("id", payload.alarm_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
