import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { loadArtistKnowledge } from "@/lib/knowledge/loadArtistKnowledge";
import { artistId, rawKnowledge, vault } from "./fixtures";

const mock = vi.hoisted(() => ({
  transaction: vi.fn(),
  select: vi.fn(),
  execute: vi.fn(),
  rows: {} as Record<string, unknown[]>,
  tables: [] as string[],
}));
vi.mock("@/lib/db/db", () => ({ db: { transaction: mock.transaction } }));

beforeEach(() => {
  vi.clearAllMocks();
  mock.tables = [];
  mock.rows = {
    users: [{ id: "caller", isAdmin: false }],
    artist_claims: [{ id: "claim" }],
    artists: [rawKnowledge.artist],
    artist_vault_sources: [vault],
    artist_social_posts: [],
    artist_interview_answers: [],
    artist_doc_corrections: [],
    artist_research_jobs: [],
    artist_docs: [],
  };
  mock.select.mockImplementation(() => ({
    from: (table: any) => {
      const name = getTableName(table);
      mock.tables.push(name);
      return { where: () => ({ limit: async () => mock.rows[name] }) };
    },
  }));
  mock.execute.mockResolvedValue([{ rows: 1, chars: 100 }]);
  mock.transaction.mockImplementation(async callback =>
    callback({ select: mock.select, execute: mock.execute }),
  );
});

describe("loadArtistKnowledge", () => {
  it("reauthorizes and reads a repeatable, read-only app-role snapshot", async () => {
    const result = await loadArtistKnowledge(artistId, "caller");
    expect(mock.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(mock.tables.slice(0, 3)).toEqual(["users", "artist_claims", "artists"]);
    expect(result.sources[0].text).toBe(vault.extractedText);
    expect(mock.execute).toHaveBeenCalledOnce();
  });
  it("denies another claimant before loading any private source/history", async () => {
    mock.rows.artist_claims = [];
    await expect(loadArtistKnowledge(artistId, "caller")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
    });
    expect(mock.tables).toEqual(["users", "artist_claims"]);
    expect(mock.execute).not.toHaveBeenCalled();
  });
  it("does not let a removed account or missing artist create an empty success", async () => {
    mock.rows.users = [];
    await expect(loadArtistKnowledge(artistId, "caller")).rejects.toMatchObject({ status: 401 });
    mock.rows.users = [{ id: "caller", isAdmin: true }];
    mock.rows.artists = [];
    await expect(loadArtistKnowledge(artistId, "caller")).rejects.toMatchObject({ status: 404 });
  });
  it("surfaces a storage outage instead of empty mandatory memory", async () => {
    mock.execute.mockRejectedValue(new Error("private connection details"));
    await expect(loadArtistKnowledge(artistId, "caller")).rejects.toThrow(
      "private connection details",
    );
  });
  it("refuses an oversized corpus before fetching private text", async () => {
    mock.execute.mockResolvedValue([{ rows: 5001, chars: 100 }]);
    await expect(loadArtistKnowledge(artistId, "caller")).rejects.toMatchObject({ status: 413 });
    expect(mock.tables).toEqual(["users", "artist_claims", "artists"]);
  });
});
