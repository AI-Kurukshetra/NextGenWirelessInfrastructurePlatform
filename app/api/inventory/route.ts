import { NextRequest } from "next/server";
import { handleTableGet, handleTablePost } from "@/lib/api-route";

export async function GET() {
  return handleTableGet("inventory_items");
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  return handleTablePost("inventory_items", payload);
}
