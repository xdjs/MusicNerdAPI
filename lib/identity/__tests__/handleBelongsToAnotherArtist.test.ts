import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn(async (_q: SQL): Promise<unknown> => []) }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { handleBelongsToAnotherArtist } =
  await import("@/lib/identity/handleBelongsToAnotherArtist");

beforeEach(() => execute.mockReset().mockResolvedValue([]));

describe("handleBelongsToAnotherArtist", () => {
  it("is true when another artist holds the handle, comparing without a leading @", async () => {
    execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    expect(await handleBelongsToAnotherArtist("a1", "instagram", "@dupes")).toBe(true);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("where lower(ltrim(instagram, '@')) = lower(ltrim($1, '@'))");
    expect(text).toContain("and id::text <> $2");
    expect(params).toEqual(["@dupes", "a1"]);
  });

  it("is false when nobody else holds it", async () => {
    expect(await handleBelongsToAnotherArtist("a1", "instagram", "dupes")).toBe(false);
  });

  it("is false without querying for a platform we don't store", async () => {
    expect(await handleBelongsToAnotherArtist("a1", "myspace; drop table", "x")).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed on a database error", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await handleBelongsToAnotherArtist("a1", "instagram", "dupes")).toBe(true);
    err.mockRestore();
  });
});
