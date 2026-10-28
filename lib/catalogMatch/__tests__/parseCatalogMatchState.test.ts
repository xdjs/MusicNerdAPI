import { expect, it } from "vitest";
import { parseCatalogMatchState } from "../parseCatalogMatchState";
const valid = {
  version: 1,
  anchor: { name: " Artist ", spotify: "A".repeat(22), deezer: null },
  expiresAtMs: 1000,
};
it("keeps the exact anchor for compare-and-set without accepting malformed catalog identities", () => {
  expect(parseCatalogMatchState(valid)).toEqual(valid);
  expect(
    parseCatalogMatchState({ ...valid, anchor: { ...valid.anchor, spotify: null, deezer: "42" } }),
  ).not.toBeNull();
});
it("rejects malformed identities, incomplete snapshots, empty names and invalid expiry", () => {
  for (const value of [
    {},
    { ...valid, version: 2 },
    { ...valid, expiresAtMs: NaN },
    { ...valid, anchor: { ...valid.anchor, name: "  " } },
    { ...valid, anchor: { ...valid.anchor, spotify: "bad" } },
    { ...valid, anchor: { ...valid.anchor, deezer: "42" } },
  ])
    expect(parseCatalogMatchState(value)).toBeNull();
});
