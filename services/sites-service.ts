import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Site, SiteFormValues } from "@/types";

export async function listSites() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("sites").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Site[];
}

export async function getSiteById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("sites").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Site;
}

export async function createSite(payload: SiteFormValues) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("sites").insert(payload).select().single();
  if (error) throw error;
  return data as Site;
}

export async function updateSite(id: string, payload: Partial<SiteFormValues>) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("sites").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Site;
}

export async function deleteSite(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) throw error;
}
