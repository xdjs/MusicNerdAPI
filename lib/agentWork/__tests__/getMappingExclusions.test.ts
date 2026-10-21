import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getMappingExclusions } from "@/lib/agentWork/getMappingExclusions";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getMappingExclusions", () => {
  it("reads a platform's exclusions newest first with the artist's name and Spotify ID", async () => {
    mock.execute.mockResolvedValueOnce([{ total: 7 }]).mockResolvedValueOnce([
      {
        id: "x1",
        artist_id: "a1",
        artist_name: "Bio Ritmo",
        spotify: "3pZ",
        platform: "deezer",
        reason: "too_ambiguous",
        details: "Three match.",
        created_at: "2026-10-20 09:15:00+00",
      },
    ]);
    expect(await getMappingExclusions("deezer", 500)).toEqual({
      exclusions: [
        {
          id: "x1",
          artistId: "a1",
          artistName: "Bio Ritmo",
          spotify: "3pZ",
          platform: "deezer",
          reason: "too_ambiguous",
          details: "Three match.",
          createdAt: "2026-10-20 09:15:00+00",
        },
      ],
      total: 7,
    });
    const count = renderSql(mock.execute.mock.calls[0][0] as SQL);
    expect(count.params).toEqual(["deezer"]);
    const page = renderSql(mock.execute.mock.calls[1][0] as SQL);
    expect(page.text).toContain(
      "JOIN artists a ON a.id = e.artist_id WHERE e.platform = $1 ORDER BY e.created_at DESC LIMIT $2",
    );
    expect(page.params).toEqual(["deezer", 500]);
  });

  it("clamps the limit to 1–500 and defaults to 100", async () => {
    mock.execute.mockResolvedValue([]);
    await getMappingExclusions("deezer", 9999);
    expect(renderSql(mock.execute.mock.calls[1][0] as SQL).params).toEqual(["deezer", 500]);
    await getMappingExclusions("deezer");
    expect(renderSql(mock.execute.mock.calls[3][0] as SQL).params).toEqual(["deezer", 100]);
  });

  it("refuses an unknown platform without querying", async () => {
    await expect(getMappingExclusions("spotify")).rejects.toThrow("Invalid platform: spotify");
    expect(mock.execute).not.toHaveBeenCalled();
  });
});
