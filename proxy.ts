import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/supabase/middleware";
import { createServerClient } from "@supabase/ssr";
import { canAccessPath } from "@/lib/permissions";

const protectedPrefixes = [
  "/dashboard",
  "/sites",
  "/equipment",
  "/subscribers",
  "/alerts",
  "/analytics",
  "/networks",
  "/spectrum",
  "/qos",
  "/security",
  "/coverage",
  "/configurations",
  "/guest-networks",
  "/load-balancing",
  "/mesh",
  "/integrations",
  "/snmp",
  "/traffic-shaping",
  "/mobile",
  "/bandwidth-throttling",
  "/failover",
  "/tickets",
  "/maintenance",
  "/inventory",
  "/billing",
  "/advanced",
  "/vendor",
  "/reports",
  "/innovation",
];
const authPrefixes = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  const isAuthPage = authPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtected && user) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      }
    );
    const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
    const role = data?.role ?? null;

    if (!canAccessPath(role, pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
