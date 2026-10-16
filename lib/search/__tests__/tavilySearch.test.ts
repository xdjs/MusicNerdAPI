import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tavilySearch } from "@/lib/search/tavilySearch";

const opts = { includeDomains: ["instagram.com"], maxResults: 3 };
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  errorSpy.mockRestore();
});

describe("tavilySearch", () => {
  it("sends a Bearer-authenticated POST with snake_case fields", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    await tavilySearch("Pete Rango music artist", opts, "tvly-secret-123");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tavily.com/search");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer tvly-secret-123",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      query: "Pete Rango music artist",
      include_domains: ["instagram.com"],
      max_results: 3,
    });
  });

  it("maps title/url/content to title/url/snippet, dropping rows without a url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              title: "IG",
              url: "https://instagram.com/p3t3rango",
              content: "Producer.",
              score: 0.9,
            },
            { title: "No URL", content: "x" },
            { url: "https://b.example" },
          ],
        }),
      })),
    );
    expect(await tavilySearch("q", opts, "k")).toEqual({
      results: [
        { title: "IG", url: "https://instagram.com/p3t3rango", snippet: "Producer." },
        { url: "https://b.example", title: "", snippet: "" },
      ],
    });
  });

  it("names every failure and logs it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await tavilySearch("q", opts, "k")).toEqual({ results: [], error: "no_response" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 432,
        text: async () => '{"detail":"plan limit exceeded"}',
      })),
    );
    expect(await tavilySearch("q", opts, "k")).toEqual({ results: [], error: "http_432" });
    expect(errorSpy.mock.calls.flat().join(" ")).toMatch(/432.*plan limit exceeded/);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("not json");
        },
      })),
    );
    expect(await tavilySearch("q", opts, "k")).toEqual({ results: [], error: "unparseable" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ results: "nope" }) })),
    );
    expect(await tavilySearch("q", opts, "k")).toEqual({ results: [], error: "no_results" });
  });
});
