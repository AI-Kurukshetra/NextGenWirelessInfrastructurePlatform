import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());
const getCurrentUserRoleAndOrgMock = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/authz", () => ({
  getCurrentUserRoleAndOrg: getCurrentUserRoleAndOrgMock,
}));

import { POST as failoverPost } from "../app/api/failover/run/route";
import { POST as integrationSyncPost } from "../app/api/integrations/sync/route";

function makeRequest(path: string, payload: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  }) as unknown as NextRequest;
}

describe("API auth/org guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    process.env.INTERNAL_API_TOKEN = "internal-token";
  });

  it("blocks failover run for non-admin/operator users", async () => {
    const insertSpy = vi.fn(async () => ({ error: null }));

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "failover_policies") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { organization_id: "org-1" }, error: null }),
              }),
            }),
          };
        }

        return { insert: insertSpy };
      },
    });

    getCurrentUserRoleAndOrgMock.mockResolvedValue({
      user: { id: "user-1" },
      role: "technician",
      organizationId: "org-1",
    });

    const response = await failoverPost(makeRequest("/api/failover/run", { policy_id: "policy-1" }));
    expect(response.status).toBe(403);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("blocks failover run for cross-organization access", async () => {
    const insertSpy = vi.fn(async () => ({ error: null }));

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "failover_policies") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { organization_id: "org-1" }, error: null }),
              }),
            }),
          };
        }

        return { insert: insertSpy };
      },
    });

    getCurrentUserRoleAndOrgMock.mockResolvedValue({
      user: { id: "user-1" },
      role: "admin",
      organizationId: "org-2",
    });

    const response = await failoverPost(makeRequest("/api/failover/run", { policy_id: "policy-1" }));
    expect(response.status).toBe(403);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("allows integration sync for operator in same org", async () => {
    const updateEqSpy = vi.fn(async () => ({ error: null }));

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "api_integrations") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { organization_id: "org-1" }, error: null }),
              }),
            }),
            update: () => ({ eq: updateEqSpy }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    getCurrentUserRoleAndOrgMock.mockResolvedValue({
      user: { id: "user-1" },
      role: "operator",
      organizationId: "org-1",
    });

    const response = await integrationSyncPost(
      makeRequest("/api/integrations/sync", { integration_id: "integration-1" })
    );

    expect(response.status).toBe(200);
    expect(updateEqSpy).toHaveBeenCalledWith("id", "integration-1");
  });

  it("allows integration sync using internal token without user lookup", async () => {
    const updateEqSpy = vi.fn(async () => ({ error: null }));

    createClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === "api_integrations") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: { organization_id: "org-1" }, error: null }),
              }),
            }),
            update: () => ({ eq: updateEqSpy }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const response = await integrationSyncPost(
      makeRequest(
        "/api/integrations/sync",
        { integration_id: "integration-1" },
        { "x-internal-token": "internal-token" }
      )
    );

    expect(response.status).toBe(200);
    expect(getCurrentUserRoleAndOrgMock).not.toHaveBeenCalled();
    expect(updateEqSpy).toHaveBeenCalledWith("id", "integration-1");
  });
});
