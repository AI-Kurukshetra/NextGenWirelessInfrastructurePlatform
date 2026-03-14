import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import type { AppRole } from "@/lib/permissions";

export async function getCurrentUserAndRole(): Promise<{ user: User | null; role: AppRole | null }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  return { user, role: (data?.role as AppRole | undefined) ?? null };
}

export async function getCurrentUserRoleAndOrg(): Promise<{
  user: User | null;
  role: AppRole | null;
  organizationId: string | null;
}> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null, organizationId: null };

  const { data } = await supabase.from("users").select("role,organization_id").eq("id", user.id).maybeSingle();
  return {
    user,
    role: (data?.role as AppRole | undefined) ?? null,
    organizationId: (data?.organization_id as string | undefined) ?? null,
  };
}
