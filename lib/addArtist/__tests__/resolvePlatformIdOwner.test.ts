import { describe, it, expect, vi } from "vitest";
import { resolvePlatformIdOwner } from "@/lib/addArtist/resolvePlatformIdOwner";

const row = (id: string, spotify: string | null = null) => ({
  id,
  name: id,
  spotify,
  deezer: null,
  customImage: null,
});
const database = (direct: unknown, mapping: unknown, mapped?: unknown) => {
  const artists = vi.fn().mockResolvedValueOnce(direct).mockResolvedValueOnce(mapped);
  return {
    query: {
      artists: { findFirst: artists },
      artistIdMappings: { findFirst: vi.fn().mockResolvedValue(mapping) },
    },
  } as never;
};

describe("resolvePlatformIdOwner", () => {
  it("is none when no artist or mapping holds the id", async () => {
    expect(await resolvePlatformIdOwner(database(undefined, undefined), "spotify", "x")).toEqual({
      status: "none",
    });
  });

  it("is the direct owner, or the mapped artist when they agree or no one holds it directly", async () => {
    expect(await resolvePlatformIdOwner(database(row("a"), undefined), "spotify", "x")).toEqual({
      status: "owner",
      owner: { id: "a", name: "a", spotify: null, deezer: null },
    });
    expect(
      await resolvePlatformIdOwner(database(row("a"), { artistId: "a" }), "spotify", "x"),
    ).toMatchObject({
      status: "owner",
      owner: { id: "a" },
    });
    expect(
      await resolvePlatformIdOwner(
        database(undefined, { artistId: "b" }, row("b")),
        "spotify",
        "x",
      ),
    ).toMatchObject({
      status: "owner",
      owner: { id: "b" },
    });
  });

  it("is a conflict when direct and mapped owners differ, or the mapped artist holds another id", async () => {
    expect(
      await resolvePlatformIdOwner(database(row("a"), { artistId: "b" }, row("b")), "spotify", "x"),
    ).toMatchObject({
      status: "conflict",
      candidates: [{ id: "a" }, { id: "b" }],
    });
    expect(
      await resolvePlatformIdOwner(
        database(undefined, { artistId: "b" }, row("b", "y")),
        "spotify",
        "x",
      ),
    ).toMatchObject({
      status: "conflict",
      candidates: [{ id: "b" }],
    });
  });
});
