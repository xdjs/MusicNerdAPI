import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { finishWebSearch } from "@/lib/search/finishWebSearch";

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => log.mockRestore());

const row = { url: "https://a.example", title: "", snippet: "" };

describe("finishWebSearch", () => {
  it("logs one [websearch] line and returns the results", () => {
    expect(
      finishWebSearch(
        { results: [row] },
        { query: "Pete Rango", domains: 1, started: Date.now(), throwOnError: false },
      ),
    ).toEqual([row]);
    expect(String(log.mock.calls[0][0])).toMatch(
      /^\[websearch\] tavily q=10 domains=1 results=1 \d+ms$/,
    );
  });

  it("returns [] on failure unless the caller asked to throw", () => {
    const ctx = { query: "q", domains: 0, started: Date.now() };
    expect(
      finishWebSearch({ results: [], error: "no_key" }, { ...ctx, throwOnError: false }),
    ).toEqual([]);
    expect(String(log.mock.calls[0][0])).toMatch(/error=no_key$/);
    expect(() =>
      finishWebSearch({ results: [], error: "http_429" }, { ...ctx, throwOnError: true }),
    ).toThrow("Web search failed (tavily: http_429)");
  });

  it("keeps a genuine empty result for a caller that throws on errors", () => {
    expect(
      finishWebSearch(
        { results: [] },
        { query: "q", domains: 0, started: Date.now(), throwOnError: true },
      ),
    ).toEqual([]);
  });
});
