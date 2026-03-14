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
  const { data: campaign, error } = await supabase.from("firmware_campaigns").select("firmware_version,target_model,organization_id").eq("id", campaign_id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("firmware_campaigns").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", campaign_id);

  const { data: assignedRows, error: assignedError } = await supabase
    .from("firmware_campaign_devices")
    .select("id,equipment_id")
    .eq("campaign_id", campaign_id);
  if (assignedError) return NextResponse.json({ error: assignedError.message }, { status: 400 });

  let targetEquipmentIds = assignedRows.map((r) => r.equipment_id);
  if (!targetEquipmentIds.length) {
    const { data: autoDevices, error: devicesError } = await supabase
      .from("equipment")
      .select("id")
      .eq("organization_id", campaign.organization_id)
      .ilike("model", `%${campaign.target_model ?? ""}%`);
    if (devicesError) return NextResponse.json({ error: devicesError.message }, { status: 400 });
    targetEquipmentIds = autoDevices.map((d) => d.id);
    if (targetEquipmentIds.length) {
      const payload = targetEquipmentIds.map((id) => ({
        campaign_id,
        equipment_id: id,
        status: "pending",
        organization_id: campaign.organization_id,
      }));
      const { error: upsertErr } = await supabase.from("firmware_campaign_devices").upsert(payload, { onConflict: "campaign_id,equipment_id" });
      if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 400 });
    }
  }

  if (targetEquipmentIds.length) {
    const { data: devicesWithVersion, error: currentErr } = await supabase
      .from("equipment")
      .select("id,firmware_version,status")
      .in("id", targetEquipmentIds);
    if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 400 });

    let successCount = 0;
    let failedCount = 0;
    for (const device of devicesWithVersion) {
      const shouldFail = device.status === "offline";
      await supabase
        .from("firmware_campaign_devices")
        .update({
          status: shouldFail ? "failed" : "applied",
          previous_firmware_version: device.firmware_version,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: shouldFail ? "Device offline during deployment" : null,
        })
        .eq("campaign_id", campaign_id)
        .eq("equipment_id", device.id);

      if (!shouldFail) {
        successCount += 1;
        await supabase.from("equipment").update({ firmware_version: campaign.firmware_version }).eq("id", device.id);
      } else {
        failedCount += 1;
      }
    }

    await supabase
      .from("firmware_campaigns")
      .update({
        status: failedCount > 0 ? "completed_with_issues" : "completed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    return NextResponse.json({ ok: true, updated_devices: successCount, failed_devices: failedCount });
  }
  await supabase
    .from("firmware_campaigns")
    .update({ status: "completed", finished_at: new Date().toISOString(), notes: "No matching devices" })
    .eq("id", campaign_id);
  return NextResponse.json({ ok: true, updated_devices: 0, failed_devices: 0 });
}
