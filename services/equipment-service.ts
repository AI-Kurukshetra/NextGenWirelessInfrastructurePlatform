import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Equipment, EquipmentFormValues } from "@/types";

export interface EquipmentWithSite extends Equipment {
  site?: { id: string; name: string };
}

export async function listEquipment() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("*, site:sites!equipment_site_id_fkey(id,name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as EquipmentWithSite[];
}

export async function getEquipmentById(id: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("equipment").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Equipment;
}

export async function createEquipment(payload: EquipmentFormValues) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("equipment").insert(payload).select().single();
  if (error) throw error;
  return data as Equipment;
}

export async function updateEquipment(id: string, payload: Partial<EquipmentFormValues>) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("equipment").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data as Equipment;
}

export interface EquipmentHealthRow {
  equipment_id: string;
  health_score: number;
  latency: number | null;
  packet_loss: number | null;
  signal_strength: number | null;
  created_at: string;
}

export async function getLatestEquipmentHealth() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("equipment_health_snapshots")
    .select("equipment_id, health_score, latency, packet_loss, signal_strength, created_at")
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) throw error;

  const dedup = new Map<string, EquipmentHealthRow>();
  for (const row of (data ?? []) as EquipmentHealthRow[]) {
    if (!dedup.has(row.equipment_id)) dedup.set(row.equipment_id, row);
  }
  return Array.from(dedup.values());
}

export async function getEquipmentHealthTimeline(equipmentId: string, limit = 36) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("equipment_health_snapshots")
    .select("health_score, latency, packet_loss, signal_strength, temperature, created_at")
    .eq("equipment_id", equipmentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .reverse()
    .map((row) => ({
      time: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      health: Number(row.health_score),
      latency: row.latency ? Number(row.latency) : 0,
      packetLoss: row.packet_loss ? Number(row.packet_loss) : 0,
      signal: row.signal_strength ? Number(row.signal_strength) : 0,
      temperature: Number(row.temperature),
    }));
}
