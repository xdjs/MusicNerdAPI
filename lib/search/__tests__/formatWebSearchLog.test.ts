import { describe, it, expect } from "vitest";
import { formatWebSearchLog } from "@/lib/search/formatWebSearchLog";

describe("formatWebSearchLog", () => {
  it("names the provider, query length, domain count, result count and time", () => {
    expect(
      formatWebSearchLog({
        provider: "tavily",
        query: "Pete Rango music",
        domains: 1,
        results: 3,
        ms: 812,
      }),
    ).toBe("[websearch] tavily q=16 domains=1 results=3 812ms");
  });

  it("appends the failure kind", () => {
    expect(
      formatWebSearchLog({
        provider: "tavily",
        query: "x",
        domains: 0,
        results: 0,
        ms: 6001,
        error: "no_response",
      }),
    ).toBe("[websearch] tavily q=1 domains=0 results=0 6001ms error=no_response");
  });

  it("never carries the query text, only its length", () => {
    expect(
      formatWebSearchLog({
        provider: "tavily",
        query: "secret artist name",
        domains: 0,
        results: 0,
        ms: 1,
      }),
    ).not.toContain("secret");
  });
});
