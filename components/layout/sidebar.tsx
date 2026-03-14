"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Boxes,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  MapPinned,
  Radio,
  Shield,
  Signal,
  Smartphone,
  Sparkles,
  Ticket,
  Wrench,
  Users,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserProfile } from "@/hooks/use-user-profile";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sites", label: "Sites", icon: MapPinned },
  { href: "/equipment", label: "Equipment", icon: Activity },
  { href: "/subscribers", label: "Subscribers", icon: Users },
  { href: "/networks", label: "Networks", icon: Wifi },
  { href: "/spectrum", label: "Spectrum", icon: Radio },
  { href: "/qos", label: "QoS", icon: Gauge },
  { href: "/bandwidth-throttling", label: "Throttling", icon: Gauge },
  { href: "/failover", label: "Failover", icon: Signal },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/coverage", label: "Coverage", icon: MapPinned },
  { href: "/configurations", label: "Config/Firmware", icon: Activity },
  { href: "/guest-networks", label: "Guest Networks", icon: Wifi },
  { href: "/load-balancing", label: "Load Balancing", icon: Signal },
  { href: "/mesh", label: "Mesh", icon: Wifi },
  { href: "/integrations", label: "Integrations", icon: Activity },
  { href: "/snmp", label: "SNMP", icon: Activity },
  { href: "/traffic-shaping", label: "Traffic Shaping", icon: Gauge },
  { href: "/mobile", label: "Mobile Control", icon: Smartphone },
  { href: "/vendor", label: "Vendor Provisioning", icon: Wrench },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/maintenance", label: "Maintenance", icon: ClipboardList },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/billing", label: "Billing", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/advanced", label: "Advanced Lab", icon: Sparkles },
  { href: "/innovation", label: "Innovation", icon: Sparkles },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: profile } = useUserProfile();
  const role = profile?.role;

  return (
    <aside className="h-full w-64 shrink-0 border-r border-slate-200 bg-white p-4">
      <div className="flex h-full min-h-0 flex-col">
        <h1 className="mb-6 shrink-0 text-lg font-semibold text-slate-900">Telecom NMS</h1>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {items
          .filter((item) => {
            if (!role || role === "admin" || role === "operator") return true;
            return ["/dashboard", "/equipment", "/alerts", "/analytics", "/mobile", "/failover", "/maintenance", "/tickets", "/vendor", "/reports", "/innovation"].includes(item.href);
          })
          .map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
        </nav>
      </div>
    </aside>
  );
}
