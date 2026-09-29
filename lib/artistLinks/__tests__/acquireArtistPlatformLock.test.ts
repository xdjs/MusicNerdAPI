import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { acquireArtistPlatformLock } from "@/lib/artistLinks/acquireArtistPlatformLock";

describe("acquireArtistPlatformLock", () => {
  it("uses MusicNerdWeb's slot key, byte for byte", async () => {
    const execute = vi.fn(async (_q: SQL) => []);
    await acquireArtistPlatformLock({ execute } as never, "artist-123", "deezer");
    expect(renderSql(execute.mock.calls[0][0]).params).toEqual([
      "musicnerd:artist-platform-slot:artist-123:deezer",
    ]);
  });
});
