import { NextResponse } from "next/server";
import { getCurrentUserRoleAndOrg } from "@/lib/authz";

export async function GET() {
  const { user, role, organizationId } = await getCurrentUserRoleAndOrg();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      role,
      organization_id: organizationId,
    },
  });
}
