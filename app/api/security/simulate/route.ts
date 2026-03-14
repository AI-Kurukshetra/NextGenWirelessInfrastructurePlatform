import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator", "technician"]);
  if ("response" in ctx) return ctx.response;

  const body = (await request.json().catch(() => ({}))) as { policy_id?: string; scenario?: string };
  const scenario = body.scenario ?? "ids_alert";

  const severity = scenario === "vpn_down" ? "high" : scenario === "auth_failure" ? "medium" : "high";
  const message =
    scenario === "vpn_down"
      ? "VPN tunnel unavailable - failover to backup policy advised"
      : scenario === "firewall_block"
        ? "Firewall blocked suspicious egress flow"
        : scenario === "auth_failure"
          ? "Multiple authentication failures detected"
          : "IDS detected anomalous traffic signature";

  const { data, error } = await ctx.supabase
    .from("security_events")
    .insert({
      event_type: scenario,
      severity,
      message,
      source_ip: "10.10.10.14",
      destination_ip: "198.51.100.20",
      protocol: "tcp",
      policy_id: body.policy_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (scenario === "vpn_down") {
    await ctx.supabase.from("vpn_tunnels").update({ status: "down" }).limit(1);
  }

  return NextResponse.json({ data });
}
