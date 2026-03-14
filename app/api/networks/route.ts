import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiContext, handleTablePost } from "@/lib/api-route";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  const [networks, links] = await Promise.all([
    ctx.supabase.from("networks").select("*").order("created_at", { ascending: false }),
    ctx.supabase.from("wireless_links").select("*").order("created_at", { ascending: false }),
  ]);

  if (networks.error) return NextResponse.json({ error: networks.error.message }, { status: 400 });
  if (links.error) return NextResponse.json({ error: links.error.message }, { status: 400 });

  return NextResponse.json({ data: { networks: networks.data ?? [], links: links.data ?? [] } });
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  return handleTablePost("networks", payload);
}
