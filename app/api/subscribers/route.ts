import { NextRequest } from "next/server";
import { handleTableGet, handleTablePost } from "@/lib/api-route";

export async function GET() {
  return handleTableGet("subscribers");
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  return handleTablePost("subscribers", payload);
}
