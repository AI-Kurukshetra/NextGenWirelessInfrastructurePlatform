import { describe, expect, it } from "vitest";
import { canAccessPath, canManage } from "../lib/permissions";

describe("permissions", () => {
  it("allows admins full manage access", () => {
    expect(canManage("admin")).toBe(true);
    expect(canAccessPath("admin", "/sites")).toBe(true);
  });

  it("restricts technician to monitor routes", () => {
    expect(canManage("technician")).toBe(false);
    expect(canAccessPath("technician", "/dashboard")).toBe(true);
    expect(canAccessPath("technician", "/sites")).toBe(false);
  });
});
