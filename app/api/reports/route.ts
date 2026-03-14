import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [sites, equipment, subscribers, alarms, tickets, billingDue] = await Promise.all([
    ctx.supabase.from("sites").select("id", { count: "exact", head: true }),
    ctx.supabase.from("equipment").select("id,status"),
    ctx.supabase.from("subscribers").select("id,status"),
    ctx.supabase.from("alarms").select("id", { count: "exact", head: true }).eq("resolved", false),
    ctx.supabase.from("tickets").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    ctx.supabase.from("billing_records").select("amount,status"),
  ]);

  if (sites.error || equipment.error || subscribers.error || alarms.error || tickets.error || billingDue.error) {
    return NextResponse.json({ error: "Unable to generate report" }, { status: 400 });
  }

  const eqRows = equipment.data ?? [];
  const subRows = subscribers.data ?? [];
  const billingRows = billingDue.data ?? [];

  const onlineEquipment = eqRows.filter((e) => e.status === "online").length;
  const activeSubscribers = subRows.filter((s) => s.status === "active").length;
  const overdueAmount = billingRows
    .filter((b) => b.status === "overdue" || b.status === "due")
    .reduce((sum, b) => sum + Number(b.amount), 0);

  return NextResponse.json({
    data: {
      active_sites: sites.count ?? 0,
      equipment_online: onlineEquipment,
      equipment_total: eqRows.length,
      subscribers_active: activeSubscribers,
      subscribers_total: subRows.length,
      open_alerts: alarms.count ?? 0,
      open_tickets: tickets.count ?? 0,
      receivables_due: Number(overdueAmount.toFixed(2)),
    },
  });
}
