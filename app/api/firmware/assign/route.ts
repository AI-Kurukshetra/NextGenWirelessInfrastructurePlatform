import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUserAndRole } from "@/lib/authz";

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = process.env.INTERNAL_API_TOKEN;

  if (!url || !serviceRole) return NextResponse.json({ error: "Missing env" }, { status: 500 });
  const internalAllowed = token && request.headers.get("x-internal-token") === token;
  if (!internalAllowed) {
    const { user, role } = await getCurrentUserAndRole();
    if (!user || (role !== "admin" && role !== "operator")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { campaign_id, equipment_ids } = await request.json();
  if (!campaign_id || !Array.isArray(equipment_ids) || !equipment_ids.length) {
    return NextResponse.json({ error: "campaign_id and equipment_ids[] required" }, { status: 400 });
  }

  const supabase = createClient(url, serviceRole);
  const { data: campaign, error: campaignError } = await supabase
    .from("firmware_campaigns")
    .select("organization_id")
    .eq("id", campaign_id)
    .single();
  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 400 });

  const payload = equipment_ids.map((id: string) => ({
    campaign_id,
    equipment_id: id,
    status: "pending",
    organization_id: campaign.organization_id,
  }));

  const { error } = await supabase
    .from("firmware_campaign_devices")
    .upsert(payload, { onConflict: "campaign_id,equipment_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, assigned: equipment_ids.length });
}
