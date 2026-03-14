import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [backlog, pilots] = await Promise.all([
    ctx.supabase.from("innovation_backlog").select("*").order("created_at", { ascending: false }),
    ctx.supabase.from("innovation_pilots").select("*").order("created_at", { ascending: false }),
  ]);

  if (backlog.error || pilots.error) {
    return NextResponse.json({ error: "Unable to load innovation data" }, { status: 400 });
  }

  return NextResponse.json({ data: { backlog: backlog.data ?? [], pilots: pilots.data ?? [] } });
}

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator"]);
  if ("response" in ctx) return ctx.response;

  const payload = (await request.json().catch(() => ({}))) as
    | { kind?: "backlog"; name?: string; category?: string; notes?: string }
    | { kind?: "pilot"; backlog_id?: string; hypothesis?: string };

  if (payload.kind === "pilot") {
    const p = payload as { backlog_id?: string; hypothesis?: string };
    if (!p.backlog_id) return NextResponse.json({ error: "backlog_id required" }, { status: 400 });

    const { data, error } = await ctx.supabase
      .from("innovation_pilots")
      .insert({ backlog_id: p.backlog_id, hypothesis: p.hypothesis ?? "", status: "planned" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  }

  const b = payload as { name?: string; category?: string; notes?: string };
  if (!b.name || !b.category) return NextResponse.json({ error: "name and category required" }, { status: 400 });

  const { data, error } = await ctx.supabase
    .from("innovation_backlog")
    .insert({ name: b.name, category: b.category, notes: b.notes ?? "", maturity: "idea", impact_score: 3, effort_score: 3 })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
