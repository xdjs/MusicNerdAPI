import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractWithTavily } from "@/lib/sourceExtraction/extractWithTavily";

const fetchMock = vi.fn();
const url = "https://www.discogs.com/artist/1-Example";
const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extractWithTavily", () => {
  it("asks Tavily for one page as plain text and returns its text", async () => {
    fetchMock.mockResolvedValue(
      ok({
        results: [{ url, raw_content: "  Profile\n\n\n\nBorn in Havana.  " }],
        failed_results: [],
      }),
    );
    expect(await extractWithTavily(url, 10_000, "key")).toEqual({
      text: "Profile\n\nBorn in Havana.",
      truncated: false,
      resolvedUrl: url,
    });
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://api.tavily.com/extract");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer key");
    expect(JSON.parse(init.body)).toEqual({
      urls: [url],
      extract_depth: "basic",
      format: "text",
      timeout: 10,
    });
  });

  it("keeps Tavily's own timeout inside the time left", async () => {
    fetchMock.mockResolvedValue(ok({ results: [], failed_results: [] }));
    await extractWithTavily(url, 2_500, "key");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).timeout).toBe(2);
  });

  it("caps the text at 50,000 characters and marks it truncated", async () => {
    fetchMock.mockResolvedValue(ok({ results: [{ url, raw_content: "a".repeat(60_000) }] }));
    const r = await extractWithTavily(url, 10_000, "key");
    expect(r?.text.length).toBe(50_000);
    expect(r?.truncated).toBe(true);
  });

  it.each([
    ["an HTTP error", () => new Response("plan exhausted", { status: 432 })],
    ["a failed URL", () => ok({ results: [], failed_results: [{ url, error: "blocked" }] })],
    ["empty text", () => ok({ results: [{ url, raw_content: "   " }] })],
    [
      "a challenge page",
      () => ok({ results: [{ url, raw_content: "Just a moment... checking your browser" }] }),
    ],
    ["unparseable JSON", () => new Response("<html>", { status: 200 })],
  ])("returns nothing for %s", async (_label, make) => {
    fetchMock.mockResolvedValue(make());
    expect(await extractWithTavily(url, 10_000, "key")).toBeNull();
  });

  it("returns nothing when Tavily does not answer, and never logs the link", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await extractWithTavily(url, 10_000, "key")).toBeNull();
    fetchMock.mockResolvedValue(new Response("nope", { status: 401 }));
    expect(await extractWithTavily(url, 10_000, "key")).toBeNull();
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain("discogs");
  });
});
