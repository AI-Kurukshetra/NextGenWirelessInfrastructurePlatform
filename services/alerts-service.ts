import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Alarm } from "@/types";

export async function listActiveAlerts() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("alarms")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Alarm[];
}

export async function resolveAlert(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("alarms").update({ resolved: true }).eq("id", id);
  if (error) throw error;
}
