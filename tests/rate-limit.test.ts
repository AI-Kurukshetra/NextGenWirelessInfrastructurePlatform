import { describe, expect, it } from "vitest";
import { checkRateLimit } from "../lib/rate-limit";

describe("rate limiter", () => {
  it("blocks after threshold", () => {
    const key = `test-${Date.now()}`;

    expect(checkRateLimit(key, 2, 10_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 10_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 10_000).allowed).toBe(false);
  });
});
