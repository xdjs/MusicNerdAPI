import { afterEach, expect, it, vi } from "vitest";
import { getDiscogsGroupFacts } from "../getDiscogsGroupFacts";
const body = {
  id: 164081,
  name: "Jamie Duffy",
  groups: [{ id: 226031, name: "Acumen Nation", active: false }],
};
afterEach(() => vi.unstubAllGlobals());
it("reads structured credits from the held ID, including former membership, with provenance", async () => {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body)));
  vi.stubGlobal("fetch", fetch);
  expect(await getDiscogsGroupFacts("164081", "Jamie Duffy")).toEqual([
    { name: "Acumen Nation", sourceUrl: "https://api.discogs.com/artists/164081" },
  ]);
  expect(fetch).toHaveBeenCalledWith(
    "https://api.discogs.com/artists/164081",
    expect.objectContaining({ redirect: "error", signal: expect.any(AbortSignal) }),
  );
});
it("does not resolve a name or fetch arbitrary URLs", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const id of ["", "../164081", "https://example.com/164081"])
    expect(await getDiscogsGroupFacts(id, "Jamie Duffy")).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
it.each([
  { ...body, id: 9 },
  { ...body, name: "Someone Else" },
  { ...body, groups: null },
])("rejects mismatched or malformed identity data", async data => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(data))),
  );
  expect(await getDiscogsGroupFacts("164081", "Jamie Duffy")).toEqual([]);
});
it("fails closed on provider failure and oversized responses", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(new Response("x".repeat(2_100_000)));
  vi.stubGlobal("fetch", fetch);
  expect(await getDiscogsGroupFacts("164081", "Jamie Duffy")).toEqual([]);
  expect(await getDiscogsGroupFacts("164081", "Jamie Duffy")).toEqual([]);
});
