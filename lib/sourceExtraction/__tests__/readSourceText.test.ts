import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSourceText } from "@/lib/sourceExtraction/readSourceText";

const m = vi.hoisted(() => ({ direct: vi.fn(), tavily: vi.fn() }));
vi.mock("@/lib/sourceExtraction/fetchSourceText", () => ({ fetchSourceText: m.direct }));
vi.mock("@/lib/sourceExtraction/extractWithTavily", () => ({ extractWithTavily: m.tavily }));

const url = "https://www.discogs.com/artist/1-Example";
const fetched = (status: string, httpStatus: number | null, extra = {}) => ({
  status,
  capturedAt: "2026-11-25T00:00:00.000Z",
  httpStatus,
  truncated: false,
  ...extra,
});

beforeEach(() => {
  vi.resetAllMocks();
  m.tavily.mockResolvedValue({ text: "Born in Havana.", truncated: false, resolvedUrl: url });
});

describe("readSourceText", () => {
  it("keeps a page the direct fetch read, without calling Tavily", async () => {
    m.direct.mockResolvedValue(fetched("ready", 200, { text: "Direct text." }));
    expect(await readSourceText(url, 15_000, "key")).toMatchObject({
      status: "ready",
      text: "Direct text.",
      reader: "direct",
    });
    expect(m.tavily).not.toHaveBeenCalled();
  });

  it.each([
    ["a 403", fetched("blocked", 403)],
    ["a 429", fetched("blocked", 429)],
    ["a challenge page", fetched("blocked", 200)],
    ["an empty page", fetched("empty", 200)],
  ])("reads the page through Tavily after %s", async (_label, result) => {
    m.direct.mockResolvedValue(result);
    expect(await readSourceText(url, 15_000, "key")).toMatchObject({
      status: "ready",
      text: "Born in Havana.",
      truncated: false,
      resolvedUrl: url,
      httpStatus: result.httpStatus,
      reader: "tavily",
      publishedAt: null,
      ogImage: null,
    });
    expect(m.tavily).toHaveBeenCalledWith(url, expect.any(Number), "key");
  });

  it.each([
    ["a link we refuse ourselves (private address, bad scheme)", fetched("blocked", null)],
    ["a redirect we refused", fetched("blocked", 302)],
    ["a missing page", fetched("unavailable", 404)],
    ["a non-HTML file", fetched("unsupported", 200)],
    ["a page that is too large", fetched("too_large", 200)],
  ])("does not send %s to Tavily", async (_label, result) => {
    m.direct.mockResolvedValue(result);
    expect(await readSourceText(url, 15_000, "key")).toEqual(result);
    expect(m.tavily).not.toHaveBeenCalled();
  });

  it("does not call Tavily without a key", async () => {
    m.direct.mockResolvedValue(fetched("blocked", 403));
    expect((await readSourceText(url, 15_000, "")).status).toBe("blocked");
    expect(m.tavily).not.toHaveBeenCalled();
  });

  it("does not call Tavily with under two seconds left", async () => {
    m.direct.mockResolvedValue(fetched("blocked", 403));
    expect((await readSourceText(url, 1_500, "key")).status).toBe("blocked");
    expect(m.tavily).not.toHaveBeenCalled();
  });

  it("keeps the direct result when Tavily cannot read the page either", async () => {
    m.direct.mockResolvedValue(fetched("blocked", 403));
    m.tavily.mockResolvedValue(null);
    expect(await readSourceText(url, 15_000, "key")).toEqual(fetched("blocked", 403));
  });
});
