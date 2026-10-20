import { describe, it, expect, vi } from "vitest";

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute } }));
const { getAgentBreakdown } = await import("@/lib/agentWork/getAgentBreakdown");

describe("getAgentBreakdown", () => {
  it("merges mappings, exclusions and last activity per key", async () => {
    execute
      .mockResolvedValueOnce([
        {
          api_key_hash: "k1",
          agent_label: "bot",
          total: 10,
          high: 6,
          medium: 3,
          low: 1,
          manual: 0,
          src_wikidata: 4,
          src_musicbrainz: 3,
          src_name_search: 2,
          src_web_search: 1,
          src_manual: 0,
        },
      ])
      .mockResolvedValueOnce([
        { api_key_hash: "k1", agent_label: "bot", total: 2 },
        { api_key_hash: "k2", agent_label: null, total: 5 },
      ])
      .mockResolvedValueOnce([{ api_key_hash: "k1", last_active_at: "t" }]);
    const { agents } = await getAgentBreakdown();
    expect(agents[0]).toEqual({
      label: "bot",
      apiKeyHash: "k1",
      resolvedCount: 10,
      excludedCount: 2,
      lastActiveAt: "t",
      byConfidence: { high: 6, medium: 3, low: 1, manual: 0 },
      bySource: { wikidata: 4, musicbrainz: 3, name_search: 2, web_search: 1, manual: 0 },
    });
    expect(agents[1]).toMatchObject({
      apiKeyHash: "k2",
      resolvedCount: 0,
      excludedCount: 5,
      lastActiveAt: null,
    });
  });
});
