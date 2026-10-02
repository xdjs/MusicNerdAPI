import { describe, it, expect, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { clearArtistLinkColumn } from "@/lib/artistLinks/clearArtistLinkColumn";

describe("clearArtistLinkColumn", () => {
  it("nulls the column and returns the old value", async () => {
    const execute = vi.fn(async (..._a: unknown[]) => []);
    const database = {
      query: { artists: { findFirst: vi.fn(async () => ({ id: "a1", instagram: "pete" })) } },
      execute,
    };
    expect(await clearArtistLinkColumn(database as never, "a1", "instagram")).toEqual({
      oldValue: "pete",
    });
    const { text, params } = renderSql(execute.mock.calls[0][0] as never);
    expect(text).toBe('UPDATE artists SET "instagram" = NULL WHERE id = $1');
    expect(params).toEqual(["a1"]);
  });

  it("throws for a missing artist", async () => {
    const database = {
      query: { artists: { findFirst: vi.fn(async () => undefined) } },
      execute: vi.fn(),
    };
    await expect(clearArtistLinkColumn(database as never, "a1", "instagram")).rejects.toThrow(
      "Artist not found: a1",
    );
    expect(database.execute).not.toHaveBeenCalled();
  });
});
