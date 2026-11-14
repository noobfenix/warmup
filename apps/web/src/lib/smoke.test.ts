import { describe, it, expect } from "vitest";
import { InMemoryRateLimiter } from "./security";

describe("Smoke Test Suite", () => {
  it("verifies basic math and environment sanity", () => {
    expect(1 + 1).toBe(2);
  });

  it("verifies in-memory rate limiter basic functionality", () => {
    const limiter = new InMemoryRateLimiter({ windowMs: 1000, maxRequests: 2 });
    const ip = "192.168.1.1";

    const first = limiter.check(ip);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);

    const second = limiter.check(ip);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);

    const third = limiter.check(ip);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });
});
