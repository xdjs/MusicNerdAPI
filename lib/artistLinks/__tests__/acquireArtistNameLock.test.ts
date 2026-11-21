import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { acquireArtistNameLock } from "@/lib/artistLinks/acquireArtistNameLock";

describe("acquireArtistNameLock", () => {
  it("uses MusicNerdWeb's key, so both apps serialize the same-name check", async () => {
    const execute = vi.fn(async (_q: SQL) => []);
    await acquireArtistNameLock({ execute } as never, "radiohead");
    expect(renderSql(execute.mock.calls[0][0]).params).toEqual(["musicnerd:artist-name:radiohead"]);
  });
});
