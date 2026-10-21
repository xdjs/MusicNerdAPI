import { it, expect, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/db", () => ({ db: { query: { artistDocs: { findFirst } } } }));
const { getArtistDocStrict } = await import("@/lib/lore/getArtistDocStrict");

it("returns the document and lets a failed read throw", async () => {
  findFirst.mockResolvedValueOnce({ content: "Lore" });
  expect(await getArtistDocStrict("a1")).toEqual({ content: "Lore" });
  findFirst.mockRejectedValueOnce(new Error("offline"));
  await expect(getArtistDocStrict("a1")).rejects.toThrow("offline");
});
