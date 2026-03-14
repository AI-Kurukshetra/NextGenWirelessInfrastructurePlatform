import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiContextMock = vi.hoisted(() => vi.fn());
const handleTableGetMock = vi.hoisted(() => vi.fn());
const handleTablePostMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-route", () => ({
  getApiContext: getApiContextMock,
  handleTableGet: handleTableGetMock,
  handleTablePost: handleTablePostMock,
}));

import { GET as inventoryGet, POST as inventoryPost } from "../app/api/inventory/route";
import { GET as billingGet, POST as billingPost } from "../app/api/billing/route";
import { GET as maintenanceGet, POST as maintenancePost } from "../app/api/maintenance/route";
import { GET as coverageGet, POST as coveragePost } from "../app/api/coverage/route";
import { GET as reportsGet } from "../app/api/reports/route";

function makeRequest(path: string, payload: Record<string, unknown>): NextRequest {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

function makeListContext(rowsByTable: Record<string, unknown[]>) {
  return {
    supabase: {
      from: (table: string) => ({
        select: () => ({
          order: () => ({
            limit: async () => ({ data: rowsByTable[table] ?? [], error: null }),
          }),
        }),
      }),
    },
    user: { id: "u-1" },
    role: "admin",
    organizationId: "org-1",
  };
}

describe("grouped API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleTableGetMock.mockResolvedValue(NextResponse.json({ data: [] }));
    handleTablePostMock.mockResolvedValue(NextResponse.json({ data: { id: "new" } }));
  });

  it("routes inventory GET/POST to inventory_items table handlers", async () => {
    await inventoryGet();
    await inventoryPost(makeRequest("/api/inventory", { name: "antenna" }));

    expect(handleTableGetMock).toHaveBeenCalledWith("inventory_items");
    expect(handleTablePostMock).toHaveBeenCalledWith("inventory_items", { name: "antenna" });
  });

  it("routes billing GET/POST to billing_records table handlers", async () => {
    await billingGet();
    await billingPost(makeRequest("/api/billing", { invoice_number: "INV-1" }));

    expect(handleTableGetMock).toHaveBeenCalledWith("billing_records", "due_date", true);
    expect(handleTablePostMock).toHaveBeenCalledWith("billing_records", { invoice_number: "INV-1" });
  });

  it("routes maintenance POST target to tickets or maintenance_tasks", async () => {
    await maintenancePost(makeRequest("/api/maintenance", { target: "ticket", title: "issue" }));
    await maintenancePost(makeRequest("/api/maintenance", { title: "task" }));

    expect(handleTablePostMock).toHaveBeenNthCalledWith(1, "tickets", { title: "issue" });
    expect(handleTablePostMock).toHaveBeenNthCalledWith(2, "maintenance_tasks", { title: "task" });
  });

  it("routes coverage POST target to zone, propagation, measurement tables", async () => {
    await coveragePost(makeRequest("/api/coverage", { target: "propagation", name: "rf-1" }));
    await coveragePost(makeRequest("/api/coverage", { target: "measurement", signal_strength: -60 }));
    await coveragePost(makeRequest("/api/coverage", { name: "zone-1" }));

    expect(handleTablePostMock).toHaveBeenNthCalledWith(1, "rf_propagation_models", { name: "rf-1" });
    expect(handleTablePostMock).toHaveBeenNthCalledWith(2, "coverage_measurements", { signal_strength: -60 });
    expect(handleTablePostMock).toHaveBeenNthCalledWith(3, "coverage_zones", { name: "zone-1" });
  });

  it("returns maintenance GET grouped payload when authorized", async () => {
    getApiContextMock.mockResolvedValue(
      makeListContext({
        maintenance_tasks: [{ id: "m-1", title: "tower check" }],
        tickets: [{ id: "t-1", title: "outage" }],
      })
    );

    const response = await maintenanceGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.tasks).toHaveLength(1);
    expect(payload.data.tickets).toHaveLength(1);
  });

  it("returns coverage GET grouped payload when authorized", async () => {
    getApiContextMock.mockResolvedValue(
      makeListContext({
        coverage_zones: [{ id: "z-1" }],
        rf_propagation_models: [{ id: "r-1" }],
        coverage_measurements: [{ id: "c-1" }],
      })
    );

    const response = await coverageGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.zones).toHaveLength(1);
    expect(payload.data.propagation_models).toHaveLength(1);
    expect(payload.data.measurements).toHaveLength(1);
  });

  it("passes through unauthorized context response for coverage and maintenance", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    getApiContextMock.mockResolvedValue({ response: unauthorized });

    const coverageResponse = await coverageGet();
    const maintenanceResponse = await maintenanceGet();

    expect(coverageResponse.status).toBe(401);
    expect(maintenanceResponse.status).toBe(401);
  });

  it("computes reports aggregation from source tables", async () => {
    getApiContextMock.mockResolvedValue({
      supabase: {
        from: (table: string) => {
          if (table === "sites") {
            return {
              select: async () => ({ data: null, error: null, count: 4 }),
            };
          }
          if (table === "equipment") {
            return {
              select: async () => ({
                data: [
                  { id: "e1", status: "online" },
                  { id: "e2", status: "offline" },
                  { id: "e3", status: "online" },
                ],
                error: null,
              }),
            };
          }
          if (table === "subscribers") {
            return {
              select: async () => ({
                data: [
                  { id: "s1", status: "active" },
                  { id: "s2", status: "suspended" },
                  { id: "s3", status: "active" },
                ],
                error: null,
              }),
            };
          }
          if (table === "alarms") {
            return {
              select: () => ({
                eq: async () => ({ data: null, error: null, count: 2 }),
              }),
            };
          }
          if (table === "tickets") {
            return {
              select: () => ({
                in: async () => ({ data: null, error: null, count: 3 }),
              }),
            };
          }
          if (table === "billing_records") {
            return {
              select: async () => ({
                data: [
                  { amount: 50, status: "due" },
                  { amount: 35.5, status: "overdue" },
                  { amount: 10, status: "paid" },
                ],
                error: null,
              }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      },
      user: { id: "u-1" },
      role: "admin",
      organizationId: "org-1",
    });

    const response = await reportsGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      active_sites: 4,
      equipment_online: 2,
      equipment_total: 3,
      subscribers_active: 2,
      subscribers_total: 3,
      open_alerts: 2,
      open_tickets: 3,
      receivables_due: 85.5,
    });
  });

  it("returns reports error when a source query fails", async () => {
    getApiContextMock.mockResolvedValue({
      supabase: {
        from: (table: string) => {
          if (table === "sites") return { select: async () => ({ data: null, error: new Error("boom"), count: null }) };
          if (table === "equipment") return { select: async () => ({ data: [], error: null }) };
          if (table === "subscribers") return { select: async () => ({ data: [], error: null }) };
          if (table === "alarms") return { select: () => ({ eq: async () => ({ data: null, error: null, count: 0 }) }) };
          if (table === "tickets") return { select: () => ({ in: async () => ({ data: null, error: null, count: 0 }) }) };
          if (table === "billing_records") return { select: async () => ({ data: [], error: null }) };
          throw new Error(`Unexpected table ${table}`);
        },
      },
      user: { id: "u-1" },
      role: "admin",
      organizationId: "org-1",
    });

    const response = await reportsGet();
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Unable to generate report");
  });
});
