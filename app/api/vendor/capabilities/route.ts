import { NextResponse } from "next/server";
import { getApiContext } from "@/lib/api-route";
import { listVendorCapabilities } from "@/lib/vendor-adapters";

export async function GET() {
  const ctx = await getApiContext();
  if ("response" in ctx) return ctx.response;

  return NextResponse.json({ data: listVendorCapabilities() });
}
