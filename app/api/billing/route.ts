import { NextRequest } from "next/server";
import { handleTableGet, handleTablePost } from "@/lib/api-route";

export async function GET() {
  return handleTableGet("billing_records", "due_date", true);
}

export async function POST(request: NextRequest) {
  const payload = await request.json();
  return handleTablePost("billing_records", payload);
}
