import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { acquirePlatformIdentityLock } from "@/lib/artistLinks/acquirePlatformIdentityLock";

describe("acquirePlatformIdentityLock", () => {
  it("uses MusicNerdWeb's key, byte for byte, so both apps serialize on it", async () => {
    const execute = vi.fn(async (_q: SQL) => []);
    await acquirePlatformIdentityLock({ execute } as never, "spotify", "spotify-123");
    expect(renderSql(execute.mock.calls[0][0]).params).toEqual([
      "musicnerd:artist-platform:spotify:spotify-123",
    ]);
  });
});
