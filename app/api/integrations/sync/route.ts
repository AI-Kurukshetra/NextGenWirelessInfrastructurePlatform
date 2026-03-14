import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUserRoleAndOrg } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.INTERNAL_API_TOKEN;

  if (!url || !serviceRole) return NextResponse.json({ error: "Missing env" }, { status: 500 });
  const internalAllowed = token && request.headers.get("x-internal-token") === token;

  const { integration_id } = await request.json();
  if (!integration_id) return NextResponse.json({ error: "integration_id required" }, { status: 400 });

  const supabase = createClient(url, serviceRole);
  const { data: integration, error: fetchError } = await supabase
    .from("api_integrations")
    .select("organization_id")
    .eq("id", integration_id)
    .single();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

  if (!internalAllowed) {
    const { user, role, organizationId } = await getCurrentUserRoleAndOrg();
    if (!user || (role !== "admin" && role !== "operator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!organizationId || organizationId !== integration.organization_id) {
      return NextResponse.json({ error: "Cross-organization access denied" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("api_integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", integration_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
