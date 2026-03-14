import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { ServicePlan } from "@/types";

export async function listServicePlans() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("service_plans").select("*").order("monthly_price", { ascending: true });
  if (error) throw error;
  return data as ServicePlan[];
}
