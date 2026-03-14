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

  const { backup_id } = await request.json();
  if (!backup_id) return NextResponse.json({ error: "backup_id required" }, { status: 400 });

  const supabase = createClient(url, serviceRole);
  const { data: backup, error } = await supabase.from("device_config_backups").select("equipment_id,config_blob,organization_id").eq("id", backup_id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: cmdError } = await supabase.from("mobile_commands").insert({
    equipment_id: backup.equipment_id,
    command: "restore_config",
    response: backup.config_blob,
    status: "queued",
    organization_id: backup.organization_id,
  });
  if (cmdError) return NextResponse.json({ error: cmdError.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
