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

  const { campaign_id } = await request.json();
  if (!campaign_id) return NextResponse.json({ error: "campaign_id required" }, { status: 400 });

  const supabase = createClient(url, serviceRole);

  const { data: rows, error } = await supabase
    .from("firmware_campaign_devices")
    .select("id,equipment_id,previous_firmware_version")
    .eq("campaign_id", campaign_id)
    .eq("status", "applied");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const restorable = rows.filter((r) => r.previous_firmware_version);
  if (restorable.length) {
    for (const row of restorable) {
      await supabase.from("equipment").update({ firmware_version: row.previous_firmware_version }).eq("id", row.equipment_id);
      await supabase
        .from("firmware_campaign_devices")
        .update({ status: "rolled_back", completed_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  }

  await supabase
    .from("firmware_campaigns")
    .update({ status: "rolled_back", finished_at: new Date().toISOString() })
    .eq("id", campaign_id);

  return NextResponse.json({ ok: true, rolled_back: restorable.length });
}
