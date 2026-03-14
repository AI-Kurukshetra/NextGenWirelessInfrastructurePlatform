import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUserAndRole } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase environment variables." }, { status: 500 });
  }

  const supabase = createClient(url, serviceRoleKey);

  const internalToken = process.env.INTERNAL_API_TOKEN;
  const incomingToken = request.headers.get("x-internal-token");

  let actorUserId = "";
  let organizationId: string | null = null;

  if (internalToken && incomingToken && internalToken === incomingToken) {
    actorUserId = "system";
    organizationId = request.headers.get("x-org-id");
  } else {
    const { user, role } = await getCurrentUserAndRole();
    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    actorUserId = user.id;
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", actorUserId)
      .maybeSingle();
    if (profileError || !profile?.organization_id) {
      return NextResponse.json({ error: "User organization not found." }, { status: 400 });
    }
    organizationId = profile.organization_id;
  }

  const rl = checkRateLimit(`seed:${actorUserId}:${request.headers.get("x-forwarded-for") ?? "local"}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: "Missing organization context." }, { status: 400 });
  }

  const { error } = await supabase.from("service_plans").insert({
    name: "API Seed Plan",
    speed_limit: 100,
    monthly_price: 49,
    bandwidth_cap: 1000,
    organization_id: organizationId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog({
    userId: actorUserId,
    organizationId,
    action: "seed_api_insert",
    entity: "service_plans",
    payload: { created: 1 },
  });

  return NextResponse.json({ ok: true });
}
