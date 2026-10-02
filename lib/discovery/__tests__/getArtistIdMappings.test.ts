import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getArtistIdMappings } = await import("@/lib/discovery/getArtistIdMappings");

beforeEach(() => {
  execute.mockReset();
});

describe("getArtistIdMappings", () => {
  it("reads the artist's mappings with confidence and source", async () => {
    execute.mockResolvedValueOnce([
      { platform: "deezer", platform_id: "9", confidence: "high", source: "wikidata" },
    ]);
    expect(await getArtistIdMappings("a1")).toEqual([
      { platform: "deezer", platformId: "9", confidence: "high", source: "wikidata" },
    ]);
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("from artist_id_mappings where artist_id = $1::uuid");
    expect(params).toEqual(["a1"]);
  });
});
