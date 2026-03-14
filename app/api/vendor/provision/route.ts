import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";
import { inferVendor, resolveVendorAdapter, type SupportedVendor } from "@/lib/vendor-adapters";

async function executeExternalProvisioning(
  ctx: Awaited<ReturnType<typeof getApiContext>>,
  vendor: SupportedVendor,
  mode: "provision" | "backup" | "firmware" | "diagnostic",
  requestPayload: Record<string, unknown>
) {
  if ("response" in ctx) return null;

  let integration:
    | {
        id: string;
        name: string;
        base_url: string | null;
        api_key_encrypted: string | null;
        enabled: boolean;
      }
    | null = null;

  try {
    const lookup = await ctx.supabase
      .from("api_integrations")
      .select("id,name,base_url,api_key_encrypted,enabled")
      .eq("provider", vendor)
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    integration = lookup.data;
  } catch {
    // External integration is optional. Fall back to local adapter provisioning.
    return null;
  }

  if (!integration?.base_url) return null;

  const endpoint = `${String(integration.base_url).replace(/\/+$/, "")}/provision`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(integration.api_key_encrypted
          ? { authorization: `Bearer ${integration.api_key_encrypted}` }
          : {}),
      },
      body: JSON.stringify({
        vendor,
        mode,
        payload: requestPayload,
      }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        vendor,
        summary: `External ${vendor} integration failed (${response.status})`,
        payload: {
          integration_id: integration.id,
          integration_name: integration.name,
          endpoint,
          response: body,
        },
      };
    }

    return {
      ok: true,
      vendor,
      summary: `External ${vendor} integration completed`,
      payload: {
        integration_id: integration.id,
        integration_name: integration.name,
        endpoint,
        response: body,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "external integration error";
    return {
      ok: false,
      vendor,
      summary: `External ${vendor} integration error`,
      payload: {
        integration_id: integration.id,
        integration_name: integration.name,
        endpoint,
        error: message,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  const ctx = await getApiContext(["admin", "operator", "technician"]);
  if ("response" in ctx) return ctx.response;

  const payload = (await request.json()) as {
    equipment_id?: string;
    profile_id?: string | null;
    mode?: "provision" | "backup" | "firmware" | "diagnostic";
    dry_run?: boolean;
    params?: Record<string, unknown>;
  };

  if (!payload.equipment_id) {
    return NextResponse.json({ error: "equipment_id required" }, { status: 400 });
  }

  const mode = payload.mode ?? "provision";
  const params = payload.params ?? {};

  const { data: equipment, error: equipmentError } = await ctx.supabase
    .from("equipment")
    .select("id,name,model,vendor,firmware_version,management_ip")
    .eq("id", payload.equipment_id)
    .single();
  if (equipmentError) return NextResponse.json({ error: equipmentError.message }, { status: 400 });

  let profile: { id: string; name: string; vendor: SupportedVendor; model_pattern: string | null; transport: "https" | "snmp" | "ssh" | "api"; config_template: Record<string, unknown> } | null = null;
  if (payload.profile_id) {
    const { data: profileData, error: profileError } = await ctx.supabase
      .from("vendor_device_profiles")
      .select("id,name,vendor,model_pattern,transport,config_template")
      .eq("id", payload.profile_id)
      .single();
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
    profile = {
      id: profileData.id,
      name: profileData.name,
      vendor: profileData.vendor as SupportedVendor,
      model_pattern: profileData.model_pattern,
      transport: profileData.transport as "https" | "snmp" | "ssh" | "api",
      config_template: (profileData.config_template as Record<string, unknown>) ?? {},
    };
  }

  const vendor = inferVendor(equipment.model, equipment.vendor);
  const adapter = resolveVendorAdapter(vendor, equipment.model);
  const requestInput = {
    equipment: {
      id: equipment.id,
      name: equipment.name,
      model: equipment.model,
      vendor,
      firmware_version: equipment.firmware_version,
      management_ip: equipment.management_ip,
    },
    profile,
    mode,
    params,
  };

  const payloadPreview = adapter.buildPayload(requestInput);
  if (payload.dry_run) {
    return NextResponse.json({
      data: {
        dry_run: true,
        vendor,
        mode,
        request_payload: payloadPreview,
      },
    });
  }

  const { data: job, error: jobError } = await ctx.supabase
    .from("provisioning_jobs")
    .insert({
      equipment_id: equipment.id,
      profile_id: profile?.id ?? null,
      vendor,
      mode,
      status: "running",
      request_payload: payloadPreview,
      initiated_by: ctx.user.id,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 400 });

  try {
    await ctx.supabase
      .from("equipment")
      .update({ vendor, provisioning_state: "provisioning" })
      .eq("id", equipment.id);

    const externalResult = await executeExternalProvisioning(ctx, vendor, mode, payloadPreview);
    const result = externalResult ?? await adapter.provision(requestInput);

    await ctx.supabase
      .from("provisioning_jobs")
      .update({
        status: result.ok ? "completed" : "failed",
        result_payload: result,
        error_message: result.ok ? null : "Provisioning failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await ctx.supabase
      .from("equipment")
      .update({ provisioning_state: result.ok ? "provisioned" : "failed", last_seen: new Date().toISOString() })
      .eq("id", equipment.id);

    return NextResponse.json({ data: { job_id: job.id, vendor, mode, result } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provisioning failed";
    await ctx.supabase
      .from("provisioning_jobs")
      .update({ status: "failed", error_message: message, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    await ctx.supabase
      .from("equipment")
      .update({ provisioning_state: "failed" })
      .eq("id", equipment.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
