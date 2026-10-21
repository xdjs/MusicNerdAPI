import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";

const findFirst = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { funfacts: { findFirst: (...a: unknown[]) => findFirst(...a) } } },
}));
const { getFunFactPrompts } = await import("@/lib/funFacts/getFunFactPrompts");

beforeEach(() => findFirst.mockReset());

describe("getFunFactPrompts", () => {
  it("reads the active prompt row", async () => {
    const row = { id: 1, surpriseMe: "Tell me about ARTIST_NAME", isActive: true };
    findFirst.mockResolvedValueOnce(row);
    expect(await getFunFactPrompts()).toEqual(row);
    const rendered = renderSql(findFirst.mock.calls[0][0].where as SQL);
    expect(rendered.text).toContain('"is_active"');
    expect(rendered.params).toEqual([true]);
  });

  it("returns null when no row is active", async () => {
    findFirst.mockResolvedValueOnce(undefined);
    expect(await getFunFactPrompts()).toBeNull();
  });

  it("returns null on a database error", async () => {
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    findFirst.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getFunFactPrompts()).toBeNull();
  });
});
