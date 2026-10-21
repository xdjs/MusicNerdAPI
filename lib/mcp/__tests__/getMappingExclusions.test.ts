import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { MappingValidationError } from "@/lib/mcp/MappingValidationError";

const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async (_q: unknown): Promise<unknown[]> => []),
}));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getMappingExclusions } = await import("@/lib/mcp/getMappingExclusions");

beforeEach(() => vi.clearAllMocks());

describe("getMappingExclusions", () => {
  it("refuses an unknown platform before touching the database", async () => {
    await expect(getMappingExclusions("myspace")).rejects.toThrow(
      new MappingValidationError("Invalid platform: myspace"),
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("counts and lists the platform's exclusions newest first, camel-cased, with the artist's name and spotify", async () => {
    execute.mockResolvedValueOnce([{ total: 7 }]).mockResolvedValueOnce([
      {
        id: "e1",
        artist_id: "a1",
        artist_name: "A",
        spotify: "s1",
        platform: "deezer",
        reason: "conflict",
        details: "d",
        created_at: "t",
      },
    ]);
    expect(await getMappingExclusions("deezer", 50)).toEqual({
      exclusions: [
        {
          id: "e1",
          artistId: "a1",
          artistName: "A",
          spotify: "s1",
          platform: "deezer",
          reason: "conflict",
          details: "d",
          createdAt: "t",
        },
      ],
      total: 7,
    });
    const count = renderSql(execute.mock.calls[0][0] as never);
    expect(count.text).toBe(
      "SELECT COUNT(*)::int AS total FROM artist_mapping_exclusions WHERE platform = $1",
    );
    expect(count.params).toEqual(["deezer"]);
    const list = renderSql(execute.mock.calls[1][0] as never);
    expect(list.text).toBe(
      "SELECT e.id, e.artist_id, a.name AS artist_name, a.spotify, e.platform, e.reason, e.details, e.created_at FROM artist_mapping_exclusions e JOIN artists a ON a.id = e.artist_id WHERE e.platform = $1 ORDER BY e.created_at DESC LIMIT $2",
    );
    expect(list.params).toEqual(["deezer", 50]);
  });

  it("defaults the limit to 100 and clamps it to 1..500", async () => {
    execute.mockResolvedValue([]);
    await getMappingExclusions("deezer");
    expect(renderSql(execute.mock.calls[1][0] as never).params).toEqual(["deezer", 100]);
    await getMappingExclusions("deezer", 9999);
    expect(renderSql(execute.mock.calls[3][0] as never).params).toEqual(["deezer", 500]);
    await getMappingExclusions("deezer", 0);
    expect(renderSql(execute.mock.calls[5][0] as never).params).toEqual(["deezer", 1]);
    expect((await getMappingExclusions("deezer")).total).toBe(0);
  });
});
