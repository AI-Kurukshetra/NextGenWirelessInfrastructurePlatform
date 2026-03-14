export type AppRole = "admin" | "operator" | "technician";

export function canManage(role: AppRole | null) {
  return role === "admin" || role === "operator";
}

export function canResolveAlerts(role: AppRole | null) {
  return role === "admin" || role === "operator";
}

export function canAccessPath(role: AppRole | null, pathname: string) {
  if (!role) return true;
  if (role === "admin" || role === "operator") return true;

  const technicianAllowed = ["/dashboard", "/equipment", "/alerts", "/analytics", "/mobile", "/failover", "/maintenance", "/tickets", "/vendor", "/reports", "/innovation"];
  return technicianAllowed.some((prefix) => pathname.startsWith(prefix));
}
