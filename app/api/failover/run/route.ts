import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUserRoleAndOrg } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.INTERNAL_API_TOKEN;

  if (!url || !serviceRole) return NextResponse.json({ error: "Missing env" }, { status: 500 });
  const internalAllowed = token && request.headers.get("x-internal-token") === token;

  const { policy_id, metric_id } = await request.json();
  if (!policy_id) return NextResponse.json({ error: "policy_id required" }, { status: 400 });

  const supabase = createClient(url, serviceRole);
  const { data: policy, error: policyError } = await supabase
    .from("failover_policies")
    .select("organization_id")
    .eq("id", policy_id)
    .single();
  if (policyError) return NextResponse.json({ error: policyError.message }, { status: 400 });

  if (!internalAllowed) {
    const { user, role, organizationId } = await getCurrentUserRoleAndOrg();
    if (!user || (role !== "admin" && role !== "operator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!organizationId || organizationId !== policy.organization_id) {
      return NextResponse.json({ error: "Cross-organization access denied" }, { status: 403 });
    }
  }

  const { error } = await supabase.from("failover_events").insert({
    policy_id,
    metric_id: metric_id ?? null,
    action: "manual_switch_to_backup",
    details: "Manually triggered via API",
    organization_id: policy.organization_id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
