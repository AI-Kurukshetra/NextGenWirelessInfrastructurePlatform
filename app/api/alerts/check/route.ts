import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUserAndRole } from "@/lib/authz";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const internalToken = process.env.INTERNAL_API_TOKEN;
  const incomingToken = request.headers.get("x-internal-token");

  let actorUserId = "system";
  let actorOrganizationId: string | null = null;
  if (!(internalToken && incomingToken && internalToken === incomingToken)) {
    const { user, role } = await getCurrentUserAndRole();
    if (!user || role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    actorUserId = user.id;
  }
  const rl = checkRateLimit(
    `alerts-check:${actorUserId}:${request.headers.get("x-forwarded-for") ?? "local"}`,
    20,
    60_000
  );
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase environment variables." }, { status: 500 });
  }

  const supabase = createClient(url, serviceRoleKey);
  if (actorUserId !== "system") {
    const { data: profile } = await supabase.from("users").select("organization_id").eq("id", actorUserId).maybeSingle();
    actorOrganizationId = profile?.organization_id ?? null;
    if (!actorOrganizationId) {
      return NextResponse.json({ error: "User organization not found." }, { status: 400 });
    }
  }

  const threshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  let query = supabase
    .from("equipment")
    .select("id,name,site_id,organization_id")
    .lt("last_seen", threshold)
    .neq("status", "offline");
  if (actorOrganizationId) {
    query = query.eq("organization_id", actorOrganizationId);
  }
  const { data: staleDevices, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!staleDevices?.length) {
    return NextResponse.json({ ok: true, created: 0 });
  }

  const { error: updateError } = await supabase
    .from("equipment")
    .update({ status: "offline" })
    .in(
      "id",
      staleDevices.map((d) => d.id)
    );

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const byOrg = staleDevices.reduce<Record<string, number>>((acc, item) => {
    acc[item.organization_id] = (acc[item.organization_id] ?? 0) + 1;
    return acc;
  }, {});
  await Promise.all(
    Object.entries(byOrg).map(([orgId, count]) =>
      writeAuditLog({
        userId: actorUserId,
        organizationId: orgId,
        action: "alerts_check_offline",
        entity: "equipment",
        payload: { count },
      })
    )
  );

  // Offline alarm rows are created by db trigger on equipment status update.
  return NextResponse.json({ ok: true, created: staleDevices.length });
}
