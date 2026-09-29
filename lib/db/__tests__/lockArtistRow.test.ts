import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { lockArtistRow } from "@/lib/db/lockArtistRow";

describe("lockArtistRow", () => {
  it("takes the artist row lock inside the caller's transaction", async () => {
    const execute = vi.fn(async (_query: SQL) => []);
    await lockArtistRow({ execute } as never, "artist-1");
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toBe("select id from artists where id = $1::uuid for update");
    expect(params).toEqual(["artist-1"]);
  });
});
