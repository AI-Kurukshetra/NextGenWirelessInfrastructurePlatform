import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator"]);
  if ("response" in ctx) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as {
    subscriber_id?: string;
    action?: "activate" | "suspend" | "resume" | "disconnect";
  };

  if (!body.subscriber_id || !body.action) {
    return NextResponse.json({ error: "subscriber_id and action are required" }, { status: 400 });
  }

  const { data: subscriber, error: subscriberError } = await ctx.supabase
    .from("subscribers")
    .select("id,status,connection_site")
    .eq("id", body.subscriber_id)
    .single();
  if (subscriberError) return NextResponse.json({ error: subscriberError.message }, { status: 400 });

  const { data: job, error: jobError } = await ctx.supabase
    .from("subscriber_provisioning_jobs")
    .insert({
      subscriber_id: body.subscriber_id,
      action: body.action,
      status: "running",
      details: { source_status: subscriber.status },
      created_by: ctx.user.id,
    })
    .select()
    .single();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 400 });

  const nextStatus = body.action === "activate" || body.action === "resume" ? "active" : "suspended";
  await ctx.supabase.from("subscribers").update({ status: nextStatus }).eq("id", body.subscriber_id);

  await ctx.supabase
    .from("subscriber_sessions")
    .upsert(
      {
        subscriber_id: body.subscriber_id,
        session_state: nextStatus === "active" ? "online" : "blocked",
        nas_identifier: "cambium-nas-1",
        ip_address: nextStatus === "active" ? "100.64.1.20" : null,
        mac_address: "02:42:ac:11:00:02",
        started_at: nextStatus === "active" ? new Date().toISOString() : null,
        ended_at: nextStatus === "active" ? null : new Date().toISOString(),
      },
      { onConflict: "subscriber_id" }
    );

  await ctx.supabase
    .from("subscriber_provisioning_jobs")
    .update({ status: "completed", finished_at: new Date().toISOString() })
    .eq("id", job.id);

  return NextResponse.json({ data: { job_id: job.id, subscriber_id: body.subscriber_id, action: body.action, status: "completed" } });
}
