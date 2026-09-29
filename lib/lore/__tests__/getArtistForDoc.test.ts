import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artists: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { getArtistForDoc } = await import("@/lib/lore/getArtistForDoc");

beforeEach(() => findFirst.mockReset());

describe("getArtistForDoc", () => {
  it("reads the artist's name and links by id", async () => {
    findFirst.mockResolvedValueOnce({ id: "a1", name: "Nova" });
    expect(await getArtistForDoc("a1")).toEqual({ id: "a1", name: "Nova" });
    const { where, columns } = findFirst.mock.calls[0][0];
    expect(renderSql(where as SQL).params).toEqual(["a1"]);
    expect(Object.keys(columns).sort()).toEqual([
      "id",
      "instagram",
      "name",
      "soundcloud",
      "spotify",
      "x",
      "youtube",
    ]);
  });

  it("lets a database error through, so the rebuild fails rather than writing an empty Lore", async () => {
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    await expect(getArtistForDoc("a1")).rejects.toThrow("pool");
  });
});
