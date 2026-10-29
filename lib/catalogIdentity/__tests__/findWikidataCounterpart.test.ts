import { describe, it, expect, vi, beforeEach } from "vitest";
import { findWikidataCounterpart } from "@/lib/catalogIdentity/findWikidataCounterpart";

const fetchMock = vi.fn();
const entity = (q: string) => ({ value: `http://www.wikidata.org/entity/${q}` });
const answer = (bindings: unknown[]) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ results: { bindings } })));

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("findWikidataCounterpart", () => {
  it("matches one entity holding one target id", async () => {
    answer([{ item: entity("Q44190"), targetId: { value: "399" } }]);
    expect(await findWikidataCounterpart("spotify", "4Z8W4fKeB5YxbusRsdQVPb", "deezer")).toEqual({
      status: "match",
      platformId: "399",
      wikidataId: "Q44190",
    });
    const body = decodeURIComponent(String(fetchMock.mock.calls[0][1].body));
    expect(body).toContain('wdt:P1902 "4Z8W4fKeB5YxbusRsdQVPb"');
    expect(body).toContain("wdt:P2722");
  });

  it("misses with no entity or no target, and is ambiguous for two of either or a shared target", async () => {
    answer([]);
    expect(await findWikidataCounterpart("deezer", "399", "spotify")).toEqual({ status: "miss" });
    answer([{ item: entity("Q1") }]);
    expect(await findWikidataCounterpart("deezer", "399", "spotify")).toEqual({ status: "miss" });
    answer([
      { item: entity("Q1"), targetId: { value: "a" } },
      { item: entity("Q2"), targetId: { value: "a" } },
    ]);
    expect(await findWikidataCounterpart("deezer", "399", "spotify")).toEqual({
      status: "ambiguous",
    });
    answer([{ item: entity("Q1"), targetId: { value: "a" }, otherTarget: entity("Q9") }]);
    expect(await findWikidataCounterpart("deezer", "399", "spotify")).toEqual({
      status: "ambiguous",
    });
  });

  it("never queries a malformed id, and throws on a failed or malformed response", async () => {
    expect(await findWikidataCounterpart("deezer", "39a", "spotify")).toEqual({ status: "miss" });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(findWikidataCounterpart("deezer", "399", "spotify")).rejects.toThrow("503");
    answer([{ item: { value: "nope" } }]);
    await expect(findWikidataCounterpart("deezer", "399", "spotify")).rejects.toThrow("malformed");
  });
});
