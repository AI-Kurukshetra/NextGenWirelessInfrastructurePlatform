import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Subscriber, SubscriberFormValues } from "@/types";

export interface SubscriberWithRelations extends Subscriber {
  plan?: { id: string; name: string };
  site?: { id: string; name: string };
}

export async function listSubscribers() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("subscribers")
    .select("*, plan:service_plans!subscribers_service_plan_id_fkey(id,name), site:sites!subscribers_connection_site_fkey(id,name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as SubscriberWithRelations[];
}

export async function createSubscriber(payload: SubscriberFormValues) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("subscribers").insert(payload).select().single();
  if (error) throw error;
  return data as Subscriber;
}

export async function updateSubscriber(id: string, payload: Partial<SubscriberFormValues>) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("subscribers").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Subscriber;
}

export async function bulkUpdateSubscriberStatus(ids: string[], status: "active" | "suspended" | "pending") {
  if (!ids.length) return;
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("subscribers").update({ status }).in("id", ids);
  if (error) throw error;
}

export async function updateSubscriberAccessControls(
  id: string,
  payload: { access_control?: string; enforced_speed_limit?: number }
) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("subscribers").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Subscriber;
}

export async function assignSubscriberQos(subscriberId: string, qosProfileId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: existing, error: existingError } = await supabase
    .from("subscriber_qos")
    .select("id")
    .eq("subscriber_id", subscriberId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await supabase
      .from("subscriber_qos")
      .update({ qos_profile_id: qosProfileId })
      .eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("subscriber_qos").insert({ subscriber_id: subscriberId, qos_profile_id: qosProfileId });
  if (error) throw error;
}

export async function listSubscriberQosAssignments() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("subscriber_qos")
    .select("subscriber_id,qos_profile:qos_profiles(id,name,max_bandwidth_mbps,priority)");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.qos_profile) ? row.qos_profile[0] : row.qos_profile;
    return {
      subscriber_id: row.subscriber_id as string,
      qos_profile: profile
        ? {
            id: profile.id as string,
            name: profile.name as string,
            max_bandwidth_mbps: Number(profile.max_bandwidth_mbps),
            priority: Number(profile.priority),
          }
        : null,
    };
  }) as Array<{
    subscriber_id: string;
    qos_profile: { id: string; name: string; max_bandwidth_mbps: number; priority: number } | null;
  }>;
}
