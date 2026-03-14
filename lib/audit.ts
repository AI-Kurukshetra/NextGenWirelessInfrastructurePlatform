import { createClient } from "@supabase/supabase-js";

interface AuditPayload {
  userId: string;
  organizationId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

export async function writeAuditLog(input: AuditPayload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return;

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await supabase.from("audit_logs").insert({
    user_id: input.userId,
    organization_id: input.organizationId ?? null,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? {},
  });
}
