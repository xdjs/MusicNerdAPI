import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { ArtistLinkConflictError } from "@/lib/artistLinks/ArtistLinkConflictError";
import { writeArtistLinkColumn } from "@/lib/artistLinks/writeArtistLinkColumn";

function database({
  artist = { id: "a1", name: "Pete Rango", instagram: "old", spotify: null } as Record<
    string,
    unknown
  > | null,
  directOwner = undefined as unknown,
  mappingOwner = undefined as unknown,
  artistMapping = undefined as unknown,
} = {}) {
  const artistsFindFirst = vi.fn();
  artistsFindFirst.mockResolvedValueOnce(artist).mockResolvedValueOnce(directOwner);
  const mappingsFindFirst = vi.fn();
  mappingsFindFirst.mockResolvedValueOnce(mappingOwner).mockResolvedValueOnce(artistMapping);
  return {
    execute: vi.fn(async (_q: SQL) => []),
    query: {
      artists: { findFirst: artistsFindFirst },
      artistIdMappings: { findFirst: mappingsFindFirst },
    },
  };
}

describe("writeArtistLinkColumn", () => {
  it("updates the column by identifier and returns the old value and name", async () => {
    const d = database();
    expect(await writeArtistLinkColumn(d as never, "a1", "instagram", "p3t3rango")).toEqual({
      oldValue: "old",
      artistName: "Pete Rango",
    });
    const { text, params } = renderSql(d.execute.mock.calls[0][0]);
    expect(text).toBe('UPDATE artists SET "instagram" = $1 WHERE id = $2');
    expect(params).toEqual(["p3t3rango", "a1"]);
  });

  it("throws for a missing artist", async () => {
    await expect(
      writeArtistLinkColumn(database({ artist: null as never }) as never, "a1", "x", "v"),
    ).rejects.toThrow("Artist not found: a1");
  });

  it("refuses a spotify id another artist holds directly or through a mapping", async () => {
    const direct = database({ directOwner: { id: "other" } });
    await expect(
      writeArtistLinkColumn(direct as never, "a1", "spotify", "S1"),
    ).rejects.toBeInstanceOf(ArtistLinkConflictError);
    expect(direct.execute).not.toHaveBeenCalled();
    const mapped = database({ mappingOwner: { artistId: "other" } });
    await expect(writeArtistLinkColumn(mapped as never, "a1", "spotify", "S1")).rejects.toThrow(
      "conflicts with an existing artist mapping",
    );
  });

  it("refuses a deezer id that diverges from this artist's own mapping", async () => {
    const d = database({ artistMapping: { platformId: "D-other" } });
    await expect(writeArtistLinkColumn(d as never, "a1", "deezer", "D1")).rejects.toThrow(
      "conflicts with an existing artist mapping",
    );
  });

  it("writes a spotify id that is free or already this artist's", async () => {
    const d = database({ directOwner: { id: "a1" }, artistMapping: { platformId: "S1" } });
    await writeArtistLinkColumn(d as never, "a1", "spotify", "S1");
    expect(d.execute).toHaveBeenCalledTimes(1);
  });
});
