import { beforeEach, expect, it, vi } from "vitest";
import { hasCorroboratedCatalogPair } from "../hasCorroboratedCatalogPair";
const m = vi.hoisted(() => ({ wiki: vi.fn(), recordings: vi.fn() }));
vi.mock("../hasVerifiedDeezerPair", () => ({ hasVerifiedDeezerPair: m.wiki }));
vi.mock("@/lib/musicPlatform/resolveCatalogCounterpart", () => ({
  resolveCatalogCounterpart: m.recordings,
}));
beforeEach(() => {
  vi.resetAllMocks();
  m.wiki.mockResolvedValue(false);
});
it("keeps independent Wikidata proof and avoids extra provider calls", async () => {
  m.wiki.mockResolvedValue(true);
  expect(await hasCorroboratedCatalogPair("s", "d", "alias")).toBe(true);
  expect(m.recordings).not.toHaveBeenCalled();
});
it("accepts only the exact recording-corroborated pair", async () => {
  m.recordings.mockResolvedValue({
    status: "verified",
    spotifyId: "s",
    deezerId: "d",
    recordings: 2,
  });
  expect(await hasCorroboratedCatalogPair("s", "d", "Pete Rango")).toBe(true);
  for (const result of [
    { status: "ambiguous" },
    { status: "provider_failure" },
    { status: "not_found" },
    { status: "verified", spotifyId: "other", deezerId: "d" },
  ]) {
    m.recordings.mockResolvedValue(result);
    expect(await hasCorroboratedCatalogPair("s", "d", "Pete Rango")).toBe(false);
  }
});
