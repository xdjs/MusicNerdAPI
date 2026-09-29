import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { acquireArtistPlatformWriteLocks } from "@/lib/artistLinks/acquireArtistPlatformWriteLocks";

describe("acquireArtistPlatformWriteLocks", () => {
  it("locks the artist/platform slot before each external id", async () => {
    const execute = vi.fn(async (_q: SQL) => []);
    await acquireArtistPlatformWriteLocks(
      { execute } as never,
      "artist-123",
      "spotify",
      "spotify-first",
    );
    await acquireArtistPlatformWriteLocks(
      { execute } as never,
      "artist-123",
      "spotify",
      "spotify-second",
    );
    expect(execute.mock.calls.map(([q]) => renderSql(q).params[0])).toEqual([
      "musicnerd:artist-platform-slot:artist-123:spotify",
      "musicnerd:artist-platform:spotify:spotify-first",
      "musicnerd:artist-platform-slot:artist-123:spotify",
      "musicnerd:artist-platform:spotify:spotify-second",
    ]);
  });
});
