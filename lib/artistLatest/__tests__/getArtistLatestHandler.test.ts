import { beforeEach, expect, it, vi } from "vitest";
import { getArtistLatestHandler } from "../getArtistLatestHandler";
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (tx: object) => unknown) => fn({}) },
}));
const { artist, stored, cards } = vi.hoisted(() => ({
  artist: vi.fn(),
  stored: vi.fn(),
  cards: vi.fn(),
}));
vi.mock("@/lib/artists/getArtistById", () => ({ getArtistById: artist }));
vi.mock("@/lib/latestProviders/getStoredLatestProviders", () => ({
  getStoredLatestProviders: stored,
}));
vi.mock("../getStoredPublicLatestCards", () => ({ getStoredPublicLatestCards: cards }));
beforeEach(() => {
  vi.clearAllMocks();
  artist.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", name: "Artist" });
  stored.mockResolvedValue({ items: [], coverage: [], unavailable: false });
  cards.mockResolvedValue([]);
});
it("rejects malformed identity without reading storage", async () => {
  expect((await getArtistLatestHandler("bad")).status).toBe(400);
  expect(artist).not.toHaveBeenCalled();
});
it("returns only the public stored projection", async () => {
  const response = await getArtistLatestHandler("00000000-0000-4000-8000-000000000001");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: "ok",
    items: [],
    coverage: [],
    unavailable: false,
  });
  expect(cards).toHaveBeenCalledOnce();
});
it("reports absent artists", async () => {
  artist.mockResolvedValue(undefined);
  expect((await getArtistLatestHandler("00000000-0000-4000-8000-000000000001")).status).toBe(404);
});
it("reports storage failure without raw details", async () => {
  cards.mockRejectedValue(new Error("secret SQL"));
  const r = await getArtistLatestHandler("00000000-0000-4000-8000-000000000001");
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("secret");
});
