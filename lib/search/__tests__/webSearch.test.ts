import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { tavily } = vi.hoisted(() => ({ tavily: vi.fn() }));
vi.mock("@/lib/search/tavilySearch", () => ({ tavilySearch: tavily }));

let warn: ReturnType<typeof vi.spyOn>;
let log: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  tavily
    .mockReset()
    .mockResolvedValue({ results: [{ url: "https://a.example", title: "A", snippet: "" }] });
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const load = async () => (await import("@/lib/search/webSearch")).webSearch;

describe("webSearch", () => {
  it("without a key: returns [] without calling Tavily, warns once per process, logs no_key", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const webSearch = await load();
    expect(await webSearch("Pete Rango", { includeDomains: ["instagram.com"] })).toEqual([]);
    await webSearch("again");
    expect(tavily).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.flat().join(" ")).toMatch(/No TAVILY_API_KEY/);
    expect(String(log.mock.calls[0][0])).toMatch(/error=no_key$/);
  });

  it("fails explicitly without a key for a caller that must not see an empty web", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    const webSearch = await load();
    await expect(webSearch("Artist", { throwOnError: true })).rejects.toThrow("no_key");
  });

  it("passes defaults and the key to Tavily and returns its rows", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-k");
    const webSearch = await load();
    expect(await webSearch("Pete Rango")).toEqual([
      { url: "https://a.example", title: "A", snippet: "" },
    ]);
    expect(tavily).toHaveBeenCalledWith(
      "Pete Rango",
      { includeDomains: [], maxResults: 5 },
      "tvly-k",
    );
    await webSearch("x", { includeDomains: ["instagram.com"], maxResults: 3 });
    expect(tavily).toHaveBeenLastCalledWith(
      "x",
      { includeDomains: ["instagram.com"], maxResults: 3 },
      "tvly-k",
    );
  });

  it("turns a provider failure into [] or, when asked, an error", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-k");
    const webSearch = await load();
    tavily.mockResolvedValueOnce({ results: [], error: "http_429" });
    expect(await webSearch("q")).toEqual([]);
    tavily.mockResolvedValueOnce({ results: [], error: "http_429" });
    await expect(webSearch("q", { throwOnError: true })).rejects.toThrow("Web search failed");
  });

  it("treats a provider that throws as a failure named threw", async () => {
    vi.stubEnv("TAVILY_API_KEY", "tvly-k");
    const webSearch = await load();
    tavily.mockImplementationOnce(async () => {
      throw new Error("boom");
    });
    expect(await webSearch("q")).toEqual([]);
    expect(err).toHaveBeenCalled();
    expect(String(log.mock.calls.at(-1)?.[0])).toMatch(/error=threw$/);
  });
});
