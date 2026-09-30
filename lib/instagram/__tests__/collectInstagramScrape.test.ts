import { describe, it, expect, vi, beforeEach } from "vitest";

const retain = vi.fn();
const cleanup = vi.fn();
const findMany = vi.fn();
const written: any[] = [];
let insideWrite = false;
let revoked = false;

vi.mock("@/lib/instagram/retainInstagramThumbnails", () => ({
  retainInstagramThumbnails: (...a: unknown[]) => retain(...a),
}));
vi.mock("@/lib/instagram/removeRevokedInstagramThumbnails", () => ({
  removeRevokedInstagramThumbnails: (...a: unknown[]) => cleanup(...a),
}));
vi.mock("@/lib/instagram/getArtistNameById", () => ({ getArtistNameById: async () => "Artist" }));
vi.mock("@/lib/instagram/upsertSocialPost", () => ({
  upsertSocialPost: async (row: unknown) => {
    expect(insideWrite).toBe(true);
    written.push(row);
  },
}));
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistSocialPosts: { findMany: (...a: unknown[]) => findMany(...a) } } },
}));
vi.mock("@/lib/research/withResearchJobWrite", async () => {
  const { OwnershipChangedError } = await import("@/lib/research/OwnershipChangedError");
  return {
    withResearchJobWrite: async (_a: string, _j: string, write: (tx: unknown) => unknown) => {
      if (revoked) throw new OwnershipChangedError();
      insideWrite = true;
      try {
        return await write({});
      } finally {
        insideWrite = false;
      }
    },
  };
});

const { collectInstagramScrape } = await import("@/lib/instagram/collectInstagramScrape");

const artist = "50f23458-df64-4381-8042-7333e8b64531";
const feed = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    ownerUsername: "artist",
    url: `https://www.instagram.com/p/p${i}/`,
  }));

beforeEach(() => {
  vi.stubEnv("APIFY_API_TOKEN", "tok");
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  retain.mockReset().mockImplementation(async (rows: any[]) => {
    expect(insideWrite).toBe(false);
    return rows.map(r => ({ ...r, raw: { _musicnerdThumbnail: { version: 1 } } }));
  });
  cleanup.mockReset();
  findMany.mockReset().mockResolvedValue([]);
  written.length = 0;
  revoked = false;
});

describe("collectInstagramScrape", () => {
  it("stores nine posts per slice, thumbnails outside the write fence, without skipping any", async () => {
    const items = feed(20);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => items })),
    );
    expect(await collectInstagramScrape(artist, "artist", "ds", "job", 0)).toMatchObject({
      ingested: 9,
      nextCursor: 9,
    });
    expect(await collectInstagramScrape(artist, "artist", "ds", "job", 9)).toMatchObject({
      ingested: 9,
      nextCursor: 18,
    });
    expect(await collectInstagramScrape(artist, "artist", "ds", "job", 18)).toEqual({
      ingested: 2,
      ownPosts: 2,
      collabPosts: 0,
    });
    expect(written.map(r => r.platformPostId)).toEqual(items.map(i => i.id));
  });

  it("stores only the latest own posts for a Latest check, in one slice", async () => {
    const now = Date.now();
    const items = [
      ...feed(12).map((p, i) => ({
        ...p,
        timestamp: new Date(now - (i + 1) * 3_600_000).toISOString(),
      })),
      {
        id: "old",
        ownerUsername: "artist",
        url: "https://www.instagram.com/p/old/",
        timestamp: new Date(now - 40 * 86_400_000).toISOString(),
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => items })),
    );
    expect(
      await collectInstagramScrape(artist, "artist", "ds", "job", 0, { latestOnly: true }),
    ).toEqual({ ingested: 9, ownPosts: 9, collabPosts: 0 });
    expect(written.map(r => r.platformPostId)).toEqual(items.slice(0, 9).map(i => i.id));
  });

  it("returns null when the dataset cannot be read, so the job retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    expect(await collectInstagramScrape(artist, "artist", "ds", "job")).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    expect(await collectInstagramScrape(artist, "artist", "ds", "job")).toBeNull();
  });

  it("does not upload for a job revoked before collection started", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => feed(1) })),
    );
    revoked = true;
    await expect(collectInstagramScrape(artist, "artist", "ds", "job")).rejects.toThrow(
      "ownership changed",
    );
    expect(retain).not.toHaveBeenCalled();
  });

  it("cleans late uploads when revocation lands during retention", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => feed(1) })),
    );
    retain.mockImplementationOnce(async (rows: any[], scope: any) => {
      revoked = true;
      scope.attemptedPaths.add("late-upload");
      return rows;
    });
    await expect(collectInstagramScrape(artist, "artist", "ds", "job")).rejects.toThrow(
      "ownership changed",
    );
    expect(written).toHaveLength(0);
    expect(cleanup).toHaveBeenCalledWith(artist, {
      jobId: "job",
      attemptedPaths: new Set(["late-upload"]),
    });
  });

  it("reuses a stored thumbnail and retains only new posts", async () => {
    const sha256 = "a".repeat(64);
    const job = "11111111-1111-4111-8111-111111111111";
    const metadata = {
      version: 1,
      sha256,
      url: `https://test.supabase.co/storage/v1/object/public/vault-files/${artist}/instagram-${job}-1-${sha256}.webp`,
    };
    findMany.mockResolvedValue([{ platformPostId: "1", raw: { _musicnerdThumbnail: metadata } }]);
    const items = [1, 2].map(id => ({
      id: String(id),
      ownerUsername: "artist",
      caption: "Updated",
      url: `https://www.instagram.com/p/p${id}/`,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => items })),
    );
    retain.mockImplementation(async (rows: any[]) => rows);
    await collectInstagramScrape(artist, "artist", "ds", "new-job");
    expect(retain.mock.calls[0][0].map((r: any) => r.platformPostId)).toEqual(["2"]);
    const reused = written.find(r => r.platformPostId === "1");
    expect(reused.raw.displayUrl).toBe(metadata.url);
    expect(reused.caption).toBe("Updated");
  });

  it("returns null without a token", async () => {
    vi.stubEnv("APIFY_API_TOKEN", "");
    expect(await collectInstagramScrape(artist, "artist", "ds", "job")).toBeNull();
  });
});
