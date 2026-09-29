import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistDocs: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { getArtistDoc } = await import("@/lib/lore/getArtistDoc");

beforeEach(() => findFirst.mockReset());

describe("getArtistDoc", () => {
  it("reads the artist's document", async () => {
    findFirst.mockResolvedValueOnce({ content: "doc" });
    expect(await getArtistDoc("a1")).toEqual({ content: "doc" });
    expect(renderSql(findFirst.mock.calls[0][0].where as SQL).params).toEqual(["a1"]);
  });

  it("returns undefined on a database error", async () => {
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getArtistDoc("a1")).toBeUndefined();
  });
});
