import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const body = rows.map((row) => headers.map((h) => escape(row[h])).join(",")).join("\n");
  return `${headers.join(",")}\n${body}`;
}

export async function GET(request: NextRequest) {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const type = request.nextUrl.searchParams.get("type") ?? "network_health";
  const format = request.nextUrl.searchParams.get("format") ?? "csv";

  const [sites, equipment, alarms, subscribers] = await Promise.all([
    ctx.supabase.from("sites").select("id,name,created_at"),
    ctx.supabase.from("equipment").select("id,name,status,temperature,last_seen,vendor"),
    ctx.supabase.from("alarms").select("id,severity,message,resolved,created_at").order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("subscribers").select("id,name,status,account_number,last_online_at"),
  ]);

  if (sites.error || equipment.error || alarms.error || subscribers.error) {
    return NextResponse.json({ error: "Unable to build report" }, { status: 400 });
  }

  let rows: Array<Record<string, unknown>> = [];
  if (type === "network_health") {
    rows = (equipment.data ?? []).map((e) => ({
      equipment_id: e.id,
      equipment_name: e.name,
      status: e.status,
      temperature: e.temperature,
      vendor: e.vendor,
      last_seen: e.last_seen,
    }));
  } else if (type === "subscriber_growth") {
    rows = (subscribers.data ?? []).map((s) => ({
      subscriber_id: s.id,
      name: s.name,
      status: s.status,
      account_number: s.account_number,
      last_online_at: s.last_online_at,
    }));
  } else {
    rows = (alarms.data ?? []).map((a) => ({
      alarm_id: a.id,
      severity: a.severity,
      message: a.message,
      resolved: a.resolved,
      created_at: a.created_at,
    }));
  }

  if (format === "json") return NextResponse.json({ data: rows });

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=report-${type}.csv`,
    },
  });
}
