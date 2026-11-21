import { describe, it, expect, vi } from "vitest";

const mock = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistBioVersions: { findMany: mock.findMany } } },
}));
const { getBioVersionsByArtistId } = await import("@/lib/bio/getBioVersionsByArtistId");

describe("getBioVersionsByArtistId", () => {
  it("returns the artist's versions, newest first", async () => {
    const rows = [{ id: "v2" }, { id: "v1" }];
    mock.findMany.mockResolvedValue(rows);
    expect(await getBioVersionsByArtistId("a1")).toBe(rows);
    expect(mock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything(), orderBy: expect.any(Function) }),
    );
  });
});
