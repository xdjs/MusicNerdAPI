import { describe, it, expect, vi, beforeEach } from "vitest";

const { transaction, publicCards, providers } = vi.hoisted(() => ({
  transaction: vi.fn(),
  publicCards: vi.fn(),
  providers: vi.fn(),
}));
const tx = { execute: vi.fn() };
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/artistLatest/getStoredPublicLatestCards", () => ({
  getStoredPublicLatestCards: publicCards,
}));
vi.mock("@/lib/latestProviders/getStoredLatestProviders", () => ({
  getStoredLatestProviders: providers,
}));
const { readArtistLatest } = await import("@/lib/artistLatest/readArtistLatest");

const card = (id: string, date: string) => ({
  id,
  kind: "instagram" as const,
  title: "t",
  text: "x",
  date,
  imageUrl: null,
  imageCaption: "c",
  sourceUrl: null,
  sourceLabel: "s",
});
const coverage = [
  {
    provider: "spotify" as const,
    status: "checked" as const,
    checkedAt: "2026-10-01T00:00:00.000Z",
    lastAttemptAt: "2026-10-01T00:00:00.000Z",
    stale: false,
  },
];

beforeEach(() => {
  transaction.mockReset().mockImplementation(async (fn: (t: unknown) => unknown) => fn(tx));
  publicCards.mockReset();
  providers.mockReset();
});

describe("readArtistLatest", () => {
  it("reads both stores in one read-only repeatable-read transaction and merges newest first", async () => {
    publicCards.mockResolvedValue([card("instagram:1", "2026-10-02T00:00:00.000Z")]);
    providers.mockResolvedValue({
      items: [card("release:spotify:1", "2026-10-03"), card("release:deezer:1", "2026-09")],
      originals: [],
      coverage,
      unavailable: false,
    });
    const result = await readArtistLatest("a1", "Bio Ritmo");
    expect(transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(publicCards).toHaveBeenCalledWith("a1", "Bio Ritmo", tx);
    expect(providers).toHaveBeenCalledWith("a1", tx);
    expect(result.items.map(i => i.id)).toEqual([
      "release:spotify:1",
      "instagram:1",
      "release:deezer:1",
    ]);
    expect(result.coverage).toBe(coverage);
    expect(result.unavailable).toBe(false);
  });

  it("passes unavailable coverage through", async () => {
    publicCards.mockResolvedValue([]);
    providers.mockResolvedValue({ items: [], originals: [], coverage, unavailable: true });
    expect(await readArtistLatest("a1", "Bio Ritmo")).toEqual({
      items: [],
      coverage,
      unavailable: true,
    });
  });
});
