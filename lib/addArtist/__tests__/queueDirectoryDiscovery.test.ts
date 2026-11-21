import { describe, it, expect, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { queueDirectoryDiscovery } from "@/lib/addArtist/queueDirectoryDiscovery";

describe("queueDirectoryDiscovery", () => {
  it("records the add, queues directory research, links a scheduled catalog match, else a Spotify match for a Deezer-only artist", async () => {
    const execute = vi.fn(async (_q: SQL) => []);
    await queueDirectoryDiscovery({ execute } as never, "a1", "u1");
    const { text, params } = renderSql(execute.mock.calls[0][0]);
    expect(text).toContain("insert into artist_activity_events");
    expect(text).toContain("'directory_add', 'directory_add'");
    expect(text).toContain("'source_search', 'pending'");
    expect(text).toContain("'directory_preparation'");
    expect(text).toContain("'spotify_match', 'pending'");
    expect(text).toContain("nullif(trim(a.spotify),'') is null");
    expect(text).toContain("counterpart.kind='catalog_match' and counterpart.activity_id is null");
    expect(text).toContain("not exists(select 1 from artist_research_jobs counterpart");
    expect(params).toEqual(["a1", "u1", "a1", "a1"]);
  });
});
