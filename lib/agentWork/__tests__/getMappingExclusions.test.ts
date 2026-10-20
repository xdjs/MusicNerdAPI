import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getMappingExclusions } = await import("@/lib/agentWork/getMappingExclusions");

describe("getMappingExclusions", () => {
  it("maps a platform's exclusions and clamps the limit", async () => {
    execute.mockResolvedValueOnce([{ total: 1 }]).mockResolvedValueOnce([
      {
        id: "e1",
        artist_id: "a1",
        artist_name: "Pete",
        spotify: "sp",
        platform: "deezer",
        reason: "conflict",
        details: null,
        created_at: "t",
      },
    ]);
    expect(await getMappingExclusions("deezer", 9999)).toEqual({
      exclusions: [
        {
          id: "e1",
          artistId: "a1",
          artistName: "Pete",
          spotify: "sp",
          platform: "deezer",
          reason: "conflict",
          details: null,
          createdAt: "t",
        },
      ],
      total: 1,
    });
    expect(new PgDialect().sqlToQuery(execute.mock.calls[1][0] as SQL).params).toEqual([
      "deezer",
      500,
    ]);
  });
});
