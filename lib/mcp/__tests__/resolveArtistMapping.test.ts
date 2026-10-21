import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { MappingConcurrentWriteError } from "@/lib/mcp/MappingConcurrentWriteError";
import { MappingConflictError } from "@/lib/mcp/MappingConflictError";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { tx, transaction, locks } = vi.hoisted(() => {
  const tx = {
    query: {
      artists: { findFirst: vi.fn(async (_o: unknown): Promise<unknown> => undefined) },
      artistIdMappings: { findFirst: vi.fn(async (_o: unknown): Promise<unknown> => undefined) },
    },
    execute: vi.fn(async (_q: unknown): Promise<unknown[]> => []),
  };
  return {
    tx,
    transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    locks: vi.fn(async (_db: unknown, _a: string, _p: string, _id: string) => {}),
  };
});
vi.mock("@/lib/db/db", () => ({ db: { transaction } }));
vi.mock("@/lib/artistLinks/acquireArtistPlatformWriteLocks", () => ({
  acquireArtistPlatformWriteLocks: locks,
}));
const { resolveArtistMapping } = await import("@/lib/mcp/resolveArtistMapping");

const base = {
  artistId: "a1",
  platform: "deezer",
  platformId: "123",
  confidence: "high",
  source: "wikidata",
  apiKeyHash: "hash",
};
const artist = { id: "a1", spotify: null, deezer: null };

beforeEach(() => {
  vi.resetAllMocks();
  transaction.mockImplementation(async (fn: (t: typeof tx) => unknown) => fn(tx));
  tx.query.artists.findFirst.mockResolvedValue(artist);
  tx.query.artistIdMappings.findFirst.mockResolvedValue(undefined);
  tx.execute.mockResolvedValue([]);
});

describe("resolveArtistMapping", () => {
  it("refuses an invalid platform, source, confidence or empty platformId before any transaction", async () => {
    for (const [patch, message] of [
      [{ platform: "myspace" }, "Invalid platform: myspace"],
      [{ source: "guess" }, "Invalid source: guess"],
      [{ confidence: "sure" }, "Invalid confidence level: sure"],
      [{ platformId: "  " }, "platformId cannot be empty"],
    ] as const) {
      await expect(resolveArtistMapping({ ...base, ...patch })).rejects.toThrow(
        MappingValidationError,
      );
      await expect(resolveArtistMapping({ ...base, ...patch })).rejects.toThrow(message);
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it("takes the platform write locks on the transaction before reading the artist", async () => {
    await resolveArtistMapping(base);
    expect(locks).toHaveBeenCalledWith(tx, "a1", "deezer", "123");
    expect(locks.mock.invocationCallOrder[0]).toBeLessThan(
      tx.query.artists.findFirst.mock.invocationCallOrder[0],
    );
    expect(tx.query.artists.findFirst.mock.calls[0][0]).toMatchObject({
      columns: { id: true, spotify: true, deezer: true },
    });
  });

  it("throws MappingNotFoundError for an unknown artist", async () => {
    tx.query.artists.findFirst.mockResolvedValue(undefined);
    await expect(resolveArtistMapping(base)).rejects.toThrow(MappingNotFoundError);
    await expect(resolveArtistMapping(base)).rejects.toThrow("Artist not found: a1");
    expect(tx.execute).not.toHaveBeenCalled();
  });

  it("for deezer, refuses an id another artist owns directly (spotify is not a mapping platform)", async () => {
    tx.query.artists.findFirst
      .mockResolvedValueOnce({ id: "a1", spotify: null, deezer: null })
      .mockResolvedValueOnce({ id: "other" });
    await expect(resolveArtistMapping({ ...base, platformId: "D1" })).rejects.toThrow(
      new MappingConflictError("platformId D1 on deezer is already owned by a different artist"),
    );
    expect(tx.execute).not.toHaveBeenCalled();
    await expect(resolveArtistMapping({ ...base, platform: "spotify" })).rejects.toThrow(
      new MappingValidationError("Invalid platform: spotify"),
    );
  });

  it("for deezer, refuses an id that differs from the artist's own deezer column", async () => {
    tx.query.artists.findFirst
      .mockResolvedValueOnce({ id: "a1", spotify: null, deezer: "999" })
      .mockResolvedValueOnce(undefined);
    await expect(
      resolveArtistMapping({ ...base, platformId: "123", platform: "deezer" }),
    ).rejects.toThrow(
      new MappingConflictError(
        "The artist's deezer field already contains a different platform ID",
      ),
    );
    expect(tx.execute).not.toHaveBeenCalled();
  });

  it("skips a lower-confidence submission and returns the stored mapping", async () => {
    tx.query.artistIdMappings.findFirst.mockResolvedValue({
      platformId: "old",
      confidence: "manual",
    });
    expect(await resolveArtistMapping({ ...base, confidence: "high" })).toEqual({
      created: false,
      updated: false,
      skipped: true,
      previousMapping: { platformId: "old", confidence: "manual" },
    });
    expect(tx.execute).not.toHaveBeenCalled();
  });

  it("updates at equal or higher confidence, with the key hash and reasoning", async () => {
    tx.query.artistIdMappings.findFirst.mockResolvedValue({
      platformId: "old",
      confidence: "high",
    });
    expect(await resolveArtistMapping({ ...base, reasoning: "why" })).toEqual({
      created: false,
      updated: true,
      skipped: false,
      previousMapping: { platformId: "old", confidence: "high" },
    });
    const { text, params } = renderSql(tx.execute.mock.calls[0][0] as never);
    expect(text).toBe(
      "UPDATE artist_id_mappings SET platform_id = $1, confidence = $2::confidence_level, source = $3, reasoning = $4, api_key_hash = $5, resolved_at = now(), updated_at = now() WHERE artist_id = $6 AND platform = $7",
    );
    expect(params).toEqual(["123", "high", "wikidata", "why", "hash", "a1", "deezer"]);
  });

  it("inserts when there is no mapping, nulling the optional fields", async () => {
    expect(await resolveArtistMapping({ ...base, apiKeyHash: undefined })).toEqual({
      created: true,
      updated: false,
      skipped: false,
    });
    const { text, params } = renderSql(tx.execute.mock.calls[0][0] as never);
    expect(text).toBe(
      "INSERT INTO artist_id_mappings (artist_id, platform, platform_id, confidence, source, reasoning, api_key_hash) VALUES ($1, $2, $3, $4::confidence_level, $5, $6, $7)",
    );
    expect(params).toEqual(["a1", "deezer", "123", "high", "wikidata", null, null]);
  });

  it("maps the platform-id unique violation to a conflict and any other 23505 to a concurrent write, direct or as cause", async () => {
    tx.execute.mockRejectedValueOnce({
      code: "23505",
      constraint_name: "artist_id_mappings_platform_id_uniq",
    });
    await expect(resolveArtistMapping(base)).rejects.toThrow(
      new MappingConflictError("platformId 123 on deezer is already mapped to a different artist"),
    );
    tx.execute.mockRejectedValueOnce(
      Object.assign(new Error("wrapped"), {
        cause: { code: "23505", constraint: "artist_id_mappings_artist_platform_uniq" },
      }),
    );
    await expect(resolveArtistMapping(base)).rejects.toThrow(MappingConcurrentWriteError);
    tx.query.artistIdMappings.findFirst.mockResolvedValue({ platformId: "old", confidence: "low" });
    tx.execute.mockRejectedValueOnce({
      code: "23505",
      constraint: "artist_id_mappings_platform_id_uniq",
    });
    await expect(resolveArtistMapping(base)).rejects.toThrow(MappingConflictError);
    tx.execute.mockRejectedValueOnce(new Error("boom"));
    await expect(resolveArtistMapping(base)).rejects.toThrow("boom");
  });
});
