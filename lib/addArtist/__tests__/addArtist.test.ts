import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const m = vi.hoisted(() => ({
  identity: vi.fn(),
  reciprocal: vi.fn(),
  owner: vi.fn(),
  queue: vi.fn(async () => {}),
  platformLock: vi.fn(async () => {}),
  nameLock: vi.fn(async () => {}),
  findMany: vi.fn(),
  returning: vi.fn(),
  values: vi.fn(),
  execute: vi.fn(async (_q: SQL) => []),
}));
const tx = {
  execute: m.execute,
  query: { artists: { findMany: m.findMany } },
  insert: () => ({
    values: (v: unknown) => (
      m.values(v),
      { onConflictDoNothing: () => ({ returning: m.returning }) }
    ),
  }),
};
vi.mock("@/lib/db/db", () => ({
  db: { transaction: async (fn: (t: unknown) => unknown) => fn(tx) },
}));
vi.mock("@/lib/catalogIdentity/getArtistIdentity", () => ({ getArtistIdentity: m.identity }));
vi.mock("@/lib/catalogIdentity/findReciprocalArtistIdentity", () => ({
  findReciprocalArtistIdentity: m.reciprocal,
}));
vi.mock("@/lib/addArtist/resolvePlatformIdOwner", () => ({ resolvePlatformIdOwner: m.owner }));
vi.mock("@/lib/addArtist/queueDirectoryDiscovery", () => ({ queueDirectoryDiscovery: m.queue }));
vi.mock("@/lib/artistLinks/acquirePlatformIdentityLock", () => ({
  acquirePlatformIdentityLock: m.platformLock,
}));
vi.mock("@/lib/artistLinks/acquireArtistNameLock", () => ({ acquireArtistNameLock: m.nameLock }));
const { addArtist: add } = await import("@/lib/addArtist/addArtist");
const addArtist = (...args: Parameters<typeof add>) =>
  add(...args) as Promise<{ body?: unknown; status?: number; error?: string }>;

const spotify = { platform: "spotify" as const, platformId: "s1", forceCreate: false };
const created = { id: "a1", name: "Radiohead", createdAt: "2026-10-28 12:00:00" };

beforeEach(() => {
  vi.clearAllMocks();
  m.identity.mockResolvedValue({ platform: "spotify", platformId: "s1", name: "Radiohead" });
  m.reciprocal.mockResolvedValue(null);
  m.owner.mockResolvedValue({ status: "none" });
  m.findMany.mockResolvedValue([]);
  m.returning.mockResolvedValue([created]);
});

describe("addArtist", () => {
  it("creates the artist, credits the adder and queues directory research", async () => {
    expect(await addArtist("u1", spotify)).toEqual({
      body: {
        result: "created",
        artistId: "a1",
        artistName: "Radiohead",
        message: "Success! You can now find this artist in our directory",
      },
      created: { createdAt: "2026-10-28 12:00:00", platformId: "s1" },
    });
    expect(m.values).toHaveBeenCalledWith({
      spotify: "s1",
      lcname: "radiohead",
      name: "Radiohead",
      addedBy: "u1",
    });
    expect(m.platformLock).toHaveBeenCalledWith(tx, "spotify", "s1");
    expect(m.nameLock).toHaveBeenCalledWith(tx, "radiohead");
    expect(m.queue).toHaveBeenCalledWith(tx, "a1", "u1");
    expect(m.execute).not.toHaveBeenCalled();
  });

  it("stores the verified other-platform id and its provenance", async () => {
    m.reciprocal.mockResolvedValue({
      platform: "deezer",
      platformId: "399",
      source: "wikidata",
      wikidataId: "Q44190",
    });
    await addArtist("u1", spotify);
    expect(m.values).toHaveBeenCalledWith(
      expect.objectContaining({ spotify: "s1", deezer: "399" }),
    );
    const { text, params } = renderSql(m.execute.mock.calls[0][0]);
    expect(text).toContain("INSERT INTO artist_id_mappings");
    expect(params).toEqual([
      "a1",
      "399",
      "wikidata",
      "Wikidata Q44190 links Spotify and Deezer for Radiohead",
    ]);
  });

  it("404s an id the platform doesn't know", async () => {
    m.identity.mockResolvedValue(null);
    expect(await addArtist("u1", spotify)).toEqual({
      status: 404,
      error: "Could not find artist on spotify",
    });
  });

  it("returns the existing artist for an id already in the directory", async () => {
    m.owner.mockResolvedValueOnce({
      status: "owner",
      owner: { id: "b", name: "Radiohead", spotify: "s1", deezer: null },
    });
    expect((await addArtist("u1", spotify)).body).toMatchObject({
      result: "exists",
      artistId: "b",
    });
    expect(m.values).not.toHaveBeenCalled();
  });

  it("offers same-name artists unless forced", async () => {
    const twin = { id: "b", name: "Radiohead", spotify: null, deezer: null, customImage: null };
    m.findMany.mockResolvedValue([twin]);
    expect((await addArtist("u1", spotify)).body).toEqual({
      result: "possible_duplicate",
      candidates: [{ id: "b", name: "Radiohead", spotify: null, deezer: null }],
      artistName: "Radiohead",
      platform: "spotify",
      platformId: "s1",
      message:
        "We found an artist with the same name. Choose the existing artist or confirm this is a different artist.",
    });
    expect((await addArtist("u1", { ...spotify, forceCreate: true })).body).toMatchObject({
      result: "created",
    });
    expect(m.nameLock).toHaveBeenCalledTimes(1);
  });

  it("409s when a concurrent writer took the record and ownership doesn't explain it", async () => {
    m.returning.mockResolvedValue([]);
    expect(await addArtist("u1", spotify)).toEqual({
      status: 409,
      error:
        "The artist could not be created because another record changed at the same time. Please try again.",
    });
    expect(m.queue).not.toHaveBeenCalled();
  });
});
