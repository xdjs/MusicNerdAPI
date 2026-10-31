import { beforeEach, expect, it, vi } from "vitest";
import { discoverDeezerCatalogCandidates } from "../discoverDeezerCatalogCandidates";
const m = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/networking/fetchJson", () => ({ fetchJson: m.fetch }));
beforeEach(() => vi.resetAllMocks());
it("ignores fuzzy names only after enumerating a complete bounded search", async () => {
  const data = Array.from({ length: 22 }, (_, i) => ({ id: i + 1, name: `Peter ${i}` }));
  data[19] = { id: 42, name: "Péte Rango" };
  m.fetch.mockResolvedValue({ data, total: 22 });
  expect(await discoverDeezerCatalogCandidates("Pete Rango")).toEqual({
    status: "complete",
    ids: ["42"],
  });
  expect(m.fetch).toHaveBeenCalledWith(expect.stringContaining("q=Pete%20Rango&limit=25"), {
    timeoutMs: 5000,
  });
});
it("preserves distinct homonyms and deduplicates provider IDs", async () => {
  m.fetch.mockResolvedValue({
    data: [
      { id: 1, name: "Pete Rango" },
      { id: 2, name: "PETE RANGO" },
      { id: 1, name: "Pete Rango" },
    ],
    total: 3,
  });
  expect(await discoverDeezerCatalogCandidates("Pete Rango")).toEqual({
    status: "complete",
    ids: ["1", "2"],
  });
});
it.each([
  { data: [{ id: 1, name: "Pete Rango" }], total: 22 },
  { data: [{ id: 1, name: "Pete Rango" }], total: 1, next: "https://api.deezer.com/next" },
  { data: Array.from({ length: 26 }, (_, i) => ({ id: i + 1, name: "Other" })), total: 26 },
  { data: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: "Pete Rango" })), total: 6 },
])("does not accept incomplete or over-budget searches: %j", async payload => {
  m.fetch.mockResolvedValue(payload);
  expect(await discoverDeezerCatalogCandidates("Pete Rango")).toEqual({
    status: "incomplete_search",
  });
});
it("accepts a complete page of 25 and up to five same-name candidates", async () => {
  const data = Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    name: i < 5 ? "Pete Rango" : "Other",
  }));
  m.fetch.mockResolvedValue({ data, total: 25 });
  expect(await discoverDeezerCatalogCandidates("Pete Rango")).toEqual({
    status: "complete",
    ids: ["1", "2", "3", "4", "5"],
  });
});
it.each([
  null,
  { error: {} },
  { data: [] },
  { data: [], total: -1 },
  { data: [], total: "0" },
  { data: [null], total: 1 },
  { data: [{ id: 0, name: "Pete Rango" }], total: 1 },
  { data: [{ id: 1, name: null }], total: 1 },
  { data: [], total: 0, next: false },
])("fails closed on malformed or unavailable data: %j", async payload => {
  m.fetch.mockResolvedValue(payload);
  await expect(discoverDeezerCatalogCandidates("Pete Rango")).rejects.toThrow();
});
it("returns no candidates for empty complete searches or empty normalized names", async () => {
  m.fetch.mockResolvedValue({ data: [], total: 0 });
  expect(await discoverDeezerCatalogCandidates("Pete Rango")).toEqual({
    status: "complete",
    ids: [],
  });
  m.fetch.mockClear();
  expect(await discoverDeezerCatalogCandidates("!!!")).toEqual({ status: "complete", ids: [] });
  expect(m.fetch).not.toHaveBeenCalled();
});
