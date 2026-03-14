import { NextResponse } from "next/server";
import type { AppRole } from "@/lib/permissions";
import { getCurrentUserRoleAndOrg } from "@/lib/authz";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function getApiContext(allowedRoles: AppRole[] = ["admin", "operator", "technician"]) {
  const supabase = await getSupabaseServerClient();
  const { user, role, organizationId } = await getCurrentUserRoleAndOrg();

  if (!user || !role || !organizationId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!allowedRoles.includes(role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { supabase, user, role, organizationId };
}

export async function handleTableGet(table: string, order = "created_at", ascending = false) {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const { data, error } = await ctx.supabase.from(table).select("*").order(order, { ascending }).limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: data ?? [] });
}

export async function handleTablePost(table: string, payload: Record<string, unknown>, allowedRoles: AppRole[] = ["admin", "operator"]) {
  const ctx = await getApiContext(allowedRoles);
  if ("response" in ctx) return ctx.response;

  const { data, error } = await ctx.supabase.from(table).insert(payload).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
