import { NextRequest, NextResponse } from "next/server";
import { getApiContext, handleTablePost } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [tasks, tickets] = await Promise.all([
    ctx.supabase.from("maintenance_tasks").select("*").order("scheduled_at", { ascending: true }).limit(200),
    ctx.supabase.from("tickets").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  if (tasks.error) return NextResponse.json({ error: tasks.error.message }, { status: 400 });
  if (tickets.error) return NextResponse.json({ error: tickets.error.message }, { status: 400 });

  return NextResponse.json({ data: { tasks: tasks.data ?? [], tickets: tickets.data ?? [] } });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const target = String(payload.target ?? "task");
  const body = { ...payload } as Record<string, unknown>;
  delete body.target;

  if (target === "ticket") return handleTablePost("tickets", body);
  return handleTablePost("maintenance_tasks", body);
}
