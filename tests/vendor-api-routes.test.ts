import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getApiContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-route", () => ({
  getApiContext: getApiContextMock,
}));

import { GET as capabilitiesGet } from "../app/api/vendor/capabilities/route";
import { POST as provisionPost } from "../app/api/vendor/provision/route";

function makeRequest(path: string, payload: Record<string, unknown>): NextRequest {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

describe("vendor api routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns capabilities when authorized", async () => {
    getApiContextMock.mockResolvedValue({
      supabase: {},
      user: { id: "u-1" },
      role: "admin",
      organizationId: "org-1",
    });

    const response = await capabilitiesGet();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.some((row: { vendor: string }) => row.vendor === "cambium")).toBe(true);
  });

  it("supports dry-run provisioning for cambium line", async () => {
    getApiContextMock.mockResolvedValue({
      supabase: {
        from: (table: string) => {
          if (table === "equipment") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "eq-1",
                      name: "Tower AP 1",
                      model: "Cambium ePMP 3000",
                      vendor: "cambium",
                      firmware_version: "4.8.2",
                      management_ip: "10.1.1.20",
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      },
      user: { id: "u-1" },
      role: "operator",
      organizationId: "org-1",
    });

    const response = await provisionPost(
      makeRequest("/api/vendor/provision", {
        equipment_id: "eq-1",
        mode: "provision",
        dry_run: true,
        params: { channel_width_mhz: 80, tx_power_dbm: 24 },
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.dry_run).toBe(true);
    expect(payload.data.vendor).toBe("cambium");
    expect(payload.data.request_payload.template.radio.channel_width_mhz).toBe(80);
  });

  it("creates and completes provisioning job on execution", async () => {
    const insertSelectSingle = vi.fn(async () => ({ data: { id: "job-1" }, error: null }));
    const updateEquipmentEq = vi.fn(async () => ({ error: null }));
    const updateJobsEq = vi.fn(async () => ({ error: null }));

    getApiContextMock.mockResolvedValue({
      supabase: {
        from: (table: string) => {
          if (table === "equipment") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "eq-1",
                      name: "Tower AP 1",
                      model: "Cambium ePMP 3000",
                      vendor: "cambium",
                      firmware_version: "4.8.2",
                      management_ip: "10.1.1.20",
                    },
                    error: null,
                  }),
                }),
              }),
              update: () => ({ eq: updateEquipmentEq }),
            };
          }

          if (table === "provisioning_jobs") {
            return {
              insert: () => ({
                select: () => ({
                  single: insertSelectSingle,
                }),
              }),
              update: () => ({ eq: updateJobsEq }),
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      },
      user: { id: "u-1" },
      role: "technician",
      organizationId: "org-1",
    });

    const response = await provisionPost(
      makeRequest("/api/vendor/provision", {
        equipment_id: "eq-1",
        mode: "diagnostic",
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.job_id).toBe("job-1");
    expect(payload.data.vendor).toBe("cambium");

    expect(insertSelectSingle).toHaveBeenCalled();
    expect(updateEquipmentEq).toHaveBeenCalled();
    expect(updateJobsEq).toHaveBeenCalled();
  });
});
