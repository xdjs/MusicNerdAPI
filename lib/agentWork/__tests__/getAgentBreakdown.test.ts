import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getAgentBreakdown } from "@/lib/agentWork/getAgentBreakdown";

const mock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: mock.execute } }));

beforeEach(() => vi.clearAllMocks());

describe("getAgentBreakdown", () => {
  it("merges mappings, exclusions and last activity by key hash", async () => {
    mock.execute
      .mockResolvedValueOnce([
        {
          api_key_hash: "h1",
          agent_label: "worker",
          total: 10,
          high: 6,
          medium: 3,
          low: 1,
          manual: 0,
          src_wikidata: 2,
          src_musicbrainz: 3,
          src_name_search: 4,
          src_web_search: 1,
          src_manual: 0,
        },
      ])
      .mockResolvedValueOnce([
        { api_key_hash: "h1", agent_label: "worker", total: 2 },
        { api_key_hash: "h2", agent_label: null, total: 5 },
      ])
      .mockResolvedValueOnce([{ api_key_hash: "h1", last_active_at: "2026-10-21 14:02:11+00" }]);
    expect(await getAgentBreakdown()).toEqual({
      agents: [
        {
          label: "worker",
          apiKeyHash: "h1",
          resolvedCount: 10,
          excludedCount: 2,
          lastActiveAt: "2026-10-21 14:02:11+00",
          byConfidence: { high: 6, medium: 3, low: 1, manual: 0 },
          bySource: { wikidata: 2, musicbrainz: 3, name_search: 4, web_search: 1, manual: 0 },
        },
        {
          label: null,
          apiKeyHash: "h2",
          resolvedCount: 0,
          excludedCount: 5,
          lastActiveAt: null,
          byConfidence: { high: 0, medium: 0, low: 0, manual: 0 },
          bySource: { wikidata: 0, musicbrainz: 0, name_search: 0, web_search: 0, manual: 0 },
        },
      ],
    });
    const texts = mock.execute.mock.calls.map(c => renderSql(c[0] as SQL).text);
    expect(texts[0]).toContain(
      "FROM artist_id_mappings m LEFT JOIN mcp_api_keys k ON k.key_hash = m.api_key_hash",
    );
    expect(texts[0]).toContain(
      "WHERE m.api_key_hash IS NOT NULL GROUP BY m.api_key_hash, k.label ORDER BY total DESC",
    );
    expect(texts[1]).toContain("FROM artist_mapping_exclusions e");
    expect(texts[2]).toContain(
      "MAX(created_at) AS last_active_at FROM mcp_audit_log GROUP BY api_key_hash",
    );
  });

  it("is empty with no agent work", async () => {
    mock.execute.mockResolvedValue([]);
    expect(await getAgentBreakdown()).toEqual({ agents: [] });
  });
});
