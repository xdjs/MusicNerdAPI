import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MAX_UNITS_PER_DOCUMENT, SEARCH_LIMIT, WEAK_COSINE_DISTANCE } from "@/lib/units/types";
import { searchUnits } from "@/lib/units/searchUnits";
import { unitHit as hit } from "./fixtures/unitHit";

const artist = "00000000-0000-4000-8000-000000000001";
const vector = [0.1, 0.2];
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const deps = (o: { vector?: ReturnType<typeof hit>[]; embedError?: Error }) => ({
  byText: vi.fn(async () => [] as ReturnType<typeof hit>[]),
  byVector: vi.fn(async () => o.vector ?? []),
  embed: vi.fn(async () => {
    if (o.embedError) throw o.embedError;
    return vector;
  }),
});

describe("searchUnits", () => {
  test("searchUnits caps units per document and marks weak results", async () => {
    const weakScore = 1 - WEAK_COSINE_DISTANCE - 0.05;
    const d = deps({
      vector: [
        ...Array.from({ length: 5 }, (_, i) => hit("a", i, weakScore)),
        ...Array.from({ length: 4 }, (_, i) => hit("b", i, weakScore)),
        ...Array.from({ length: 4 }, (_, i) => hit("c", i, weakScore)),
      ],
    });
    const result = await searchUnits(artist, "first tour", { names: ["Mike Dean"], deps: d });
    expect(result.weak).toBe(true);
    expect(result.hits).toHaveLength(SEARCH_LIMIT);
    const perDoc = Object.groupBy(result.hits, h => h.sourceId);
    expect(perDoc.a!.map(h => h.unitIndex)).toEqual([0, 1, 2]);
    expect(perDoc.b).toHaveLength(MAX_UNITS_PER_DOCUMENT);
    expect(perDoc.c!.map(h => h.unitIndex)).toEqual([0, 1]);
    // One embedding of the raw question; text search per expanded query.
    expect(d.embed).toHaveBeenCalledOnce();
    expect(d.embed.mock.calls[0]).toEqual(["first tour", { signal: undefined }]);
    expect(d.byText.mock.calls.map(c => c.slice(0, 2))).toEqual([
      [artist, "first tour"],
      [artist, "first tour Mike Dean"],
    ]);
    expect(d.byVector).toHaveBeenCalledWith(artist, vector);
  });

  test("is not weak when text matched or a vector is close", async () => {
    const close = deps({ vector: [hit("a", 0, 1 - WEAK_COSINE_DISTANCE + 0.01)] });
    expect((await searchUnits(artist, "q", { names: [], deps: close })).weak).toBe(false);
    const texty = deps({ vector: [hit("a", 0, 0.1)] });
    texty.byText.mockResolvedValueOnce([hit("b", 0, 0.3)]);
    const result = await searchUnits(artist, "q", { names: [], deps: texty });
    expect(result.weak).toBe(false);
    expect(result.hits.map(h => h.sourceId)).toEqual(["b", "a"]);
  });

  test("ranks a unit both searches found above either alone", async () => {
    const d = deps({ vector: [hit("v", 0, 0.9), hit("both", 0, 0.8)] });
    d.byText.mockResolvedValue([hit("t", 0, 2), hit("both", 0, 1)]);
    const { hits } = await searchUnits(artist, "q", { names: ["Name"], deps: d });
    expect(hits[0].sourceId).toBe("both");
  });

  test("searchUnits falls back to text when embedding fails", async () => {
    const error = new Error("secret question text in the message");
    error.name = "GatewayError";
    const d = deps({ embedError: error });
    d.byText.mockResolvedValue([hit("t", 0, 0.5)]);
    const result = await searchUnits(artist, "secret question", { names: [], deps: d });
    expect(result).toMatchObject({ weak: false, hits: [{ sourceId: "t" }] });
    expect(d.byVector).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    const logged = JSON.stringify(warn.mock.calls[0]);
    expect(logged).toContain("GatewayError");
    expect(logged).not.toContain("secret");
  });

  test("rethrows when the caller aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const d = deps({ embedError: new DOMException("aborted", "AbortError") });
    await expect(
      searchUnits(artist, "q", { names: [], signal: controller.signal, deps: d }),
    ).rejects.toThrow();
    expect(d.byText).not.toHaveBeenCalled();
  });

  test("is weak with nothing found", async () => {
    expect(await searchUnits(artist, "q", { names: [], deps: deps({}) })).toEqual({
      hits: [],
      weak: true,
    });
  });
});
