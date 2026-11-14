import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  MAX_UNITS_PER_DOCUMENT,
  SEARCH_CANDIDATES,
  SEARCH_LIMIT,
  WEAK_COSINE_DISTANCE,
} from "@/lib/units/types";
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
    expect(d.byText.mock.calls).toEqual([
      [artist, "first tour", SEARCH_CANDIDATES, "and"],
      [artist, "first tour Mike Dean", SEARCH_CANDIDATES, "and"],
    ]);
    expect(d.byVector).toHaveBeenCalledWith(artist, vector, SEARCH_CANDIDATES);
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
      signals: { textMatched: false, bestVectorScore: null },
    });
  });

  test("tuning raises the per-document cap", async () => {
    const d = deps({ vector: Array.from({ length: 8 }, (_, i) => hit("a", i, 0.9)) });
    const tuning = { maxUnitsPerDocument: 5, textMode: "and" as const, candidates: 20 };
    const { hits } = await searchUnits(artist, "q", { names: [], deps: { ...d, tuning } });
    expect(hits.map(h => h.unitIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  test("tuning passes the text mode and candidate count to both searches", async () => {
    const d = deps({});
    const tuning = { maxUnitsPerDocument: 3, textMode: "or" as const, candidates: 40 };
    await searchUnits(artist, "q", { names: [], deps: { ...d, tuning } });
    expect(d.byText).toHaveBeenCalledWith(artist, "q", 40, "or");
    expect(d.byVector).toHaveBeenCalledWith(artist, vector, 40);
  });

  test("reads the tuning from the environment by default", async () => {
    vi.stubEnv("UNITS_MAX_PER_DOCUMENT", "1");
    vi.stubEnv("UNITS_TEXT_MODE", "or");
    vi.stubEnv("UNITS_CANDIDATES", "30");
    try {
      const d = deps({ vector: [hit("a", 0, 0.9), hit("a", 1, 0.9)] });
      const { hits } = await searchUnits(artist, "q", { names: [], deps: d });
      expect(hits).toHaveLength(1);
      expect(d.byText).toHaveBeenCalledWith(artist, "q", 30, "or");
      expect(d.byVector).toHaveBeenCalledWith(artist, vector, 30);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test("reports the signals behind weak: any text match and the best vector score", async () => {
    const d = deps({ vector: [hit("a", 0, 0.31), hit("b", 0, 0.42)] });
    expect(await searchUnits(artist, "q", { names: [], deps: d })).toMatchObject({
      weak: !(0.42 >= 1 - WEAK_COSINE_DISTANCE),
      signals: { textMatched: false, bestVectorScore: 0.42 },
    });
    d.byText.mockResolvedValueOnce([hit("t", 0, 0.3)]);
    expect((await searchUnits(artist, "q", { names: [], deps: d })).signals).toEqual({
      textMatched: true,
      bestVectorScore: 0.42,
    });
    const textOnly = deps({ embedError: new Error("down") });
    expect((await searchUnits(artist, "q", { names: [], deps: textOnly })).signals).toEqual({
      textMatched: false,
      bestVectorScore: null,
    });
  });
});
