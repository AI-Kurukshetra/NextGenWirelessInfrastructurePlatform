import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function mustExist(relativePath: string) {
  const abs = path.join(root, relativePath);
  expect(fs.existsSync(abs), `${relativePath} should exist`).toBe(true);
}

function readMigrations() {
  const migrationDir = path.join(root, "db", "migrations");
  const files = fs.readdirSync(migrationDir).sort();
  return files.map((f) => fs.readFileSync(path.join(migrationDir, f), "utf8")).join("\n");
}

describe("PDF requirements coverage", () => {
  it("keeps required project structure directories", () => {
    [
      "app",
      "components",
      "lib",
      "hooks",
      "services",
      "types",
      "supabase",
      "db",
      "scripts",
    ].forEach(mustExist);
  });

  it("keeps required MVP and core feature pages/routes", () => {
    [
      "app/dashboard/page.tsx",
      "app/sites/page.tsx",
      "app/sites/[id]/page.tsx",
      "app/equipment/page.tsx",
      "app/equipment/[id]/page.tsx",
      "app/subscribers/page.tsx",
      "app/alerts/page.tsx",
      "app/analytics/page.tsx",
      "app/networks/page.tsx",
      "app/spectrum/page.tsx",
      "app/qos/page.tsx",
      "app/failover/page.tsx",
      "app/security/page.tsx",
      "app/coverage/page.tsx",
      "app/configurations/page.tsx",
      "app/guest-networks/page.tsx",
      "app/load-balancing/page.tsx",
      "app/mesh/page.tsx",
      "app/integrations/page.tsx",
      "app/snmp/page.tsx",
      "app/mobile/page.tsx",
      "app/bandwidth-throttling/page.tsx",
      "app/traffic-shaping/page.tsx",
      "app/vendor/page.tsx",
      "app/api/auth/route.ts",
      "app/api/sites/route.ts",
      "app/api/equipment/route.ts",
      "app/api/subscribers/route.ts",
      "app/api/networks/route.ts",
      "app/api/monitoring/route.ts",
      "app/api/configuration/route.ts",
      "app/api/analytics/route.ts",
      "app/api/alerts/route.ts",
      "app/api/inventory/route.ts",
      "app/api/billing/route.ts",
      "app/api/coverage/route.ts",
      "app/api/maintenance/route.ts",
      "app/api/spectrum/route.ts",
      "app/api/reports/route.ts",
    ].forEach(mustExist);
  });

  it("keeps blueprint key entities in migrations", () => {
    const sql = readMigrations();
    [
      "public.organizations",
      "public.users",
      "public.sites",
      "public.equipment",
      "public.links",
      "public.service_plans",
      "public.subscribers",
      "public.performance_metrics",
      "public.alarms",
      "public.networks",
      "public.wireless_links",
      "public.device_config_backups",
      "public.tickets",
      "public.inventory_items",
      "public.maintenance_tasks",
      "public.billing_records",
      "public.coverage_zones",
      "public.rf_propagation_models",
      "public.coverage_measurements",
    ].forEach((entity) => {
      expect(sql.includes(entity), `Missing migration entity: ${entity}`).toBe(true);
    });
  });
});

