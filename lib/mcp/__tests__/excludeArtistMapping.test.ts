import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { MappingNotFoundError } from "@/lib/mcp/MappingNotFoundError";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { execute, findFirst } = vi.hoisted(() => ({
  execute: vi.fn(async (_q: unknown): Promise<unknown[]> => []),
  findFirst: vi.fn(async (_o: unknown): Promise<unknown> => ({ id: "a1" })),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute, query: { artists: { findFirst } } } }));
const { excludeArtistMapping } = await import("@/lib/mcp/excludeArtistMapping");

const base = { artistId: "a1", platform: "deezer", reason: "conflict" as const };

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockResolvedValue({ id: "a1" });
});

describe("excludeArtistMapping", () => {
  it("refuses an unknown platform or reason before any query", async () => {
    await expect(excludeArtistMapping({ ...base, platform: "myspace" })).rejects.toThrow(
      new MappingValidationError("Invalid platform: myspace"),
    );
    await expect(
      excludeArtistMapping({ ...base, reason: "bored" as unknown as "conflict" }),
    ).rejects.toThrow(new MappingValidationError("Invalid exclusion reason: bored"));
    expect(findFirst).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("throws MappingNotFoundError for an unknown artist", async () => {
    findFirst.mockResolvedValue(undefined);
    await expect(excludeArtistMapping(base)).rejects.toThrow(
      new MappingNotFoundError("Artist not found: a1"),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("upserts by artist and platform; xmax 0 means created", async () => {
    execute.mockResolvedValue([{ xmax: "0" }]);
    expect(await excludeArtistMapping({ ...base, details: "d", apiKeyHash: "hash" })).toEqual({
      created: true,
      updated: false,
    });
    const { text, params } = renderSql(execute.mock.calls[0][0] as never);
    expect(text).toBe(
      "INSERT INTO artist_mapping_exclusions (artist_id, platform, reason, details, api_key_hash) VALUES ($1, $2, $3::exclusion_reason, $4, $5) ON CONFLICT (artist_id, platform) DO UPDATE SET reason = EXCLUDED.reason, details = EXCLUDED.details, api_key_hash = EXCLUDED.api_key_hash RETURNING xmax",
    );
    expect(params).toEqual(["a1", "deezer", "conflict", "d", "hash"]);
  });

  it("a non-zero xmax means updated, and omitted details and key are null", async () => {
    execute.mockResolvedValue([{ xmax: "12345" }]);
    expect(await excludeArtistMapping(base)).toEqual({ created: false, updated: true });
    expect(renderSql(execute.mock.calls[0][0] as never).params).toEqual([
      "a1",
      "deezer",
      "conflict",
      null,
      null,
    ]);
  });
});
