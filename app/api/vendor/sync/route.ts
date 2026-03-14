import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";
import { inferVendor, resolveVendorAdapter } from "@/lib/vendor-adapters";

export async function POST() {
  const ctx = await getApiContext(["admin", "operator"]);
  if ("response" in ctx) return ctx.response;

  const { data: devices, error: deviceError } = await ctx.supabase
    .from("equipment")
    .select("id,name,model,vendor,management_ip,firmware_version")
    .limit(200);
  if (deviceError) return NextResponse.json({ error: deviceError.message }, { status: 400 });

  const updates: Array<{ equipment_id: string; vendor: string; capabilities: string[]; reachable: boolean }> = [];
  for (const device of devices ?? []) {
    const vendor = inferVendor(device.model, device.vendor);
    const adapter = resolveVendorAdapter(vendor, device.model);
    updates.push({
      equipment_id: device.id,
      vendor,
      capabilities: adapter.capabilities(),
      reachable: Boolean(device.management_ip),
    });

    await ctx.supabase
      .from("equipment")
      .update({ vendor, provisioning_state: device.management_ip ? "provisioned" : "unprovisioned" })
      .eq("id", device.id);
  }

  return NextResponse.json({ data: { synced: updates.length, devices: updates } });
}
