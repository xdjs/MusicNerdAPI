import { beforeEach, expect, it, vi } from "vitest";
import { getQuestionResearchStatus } from "../getQuestionResearchStatus";
const m = vi.hoisted(() => ({ execute: vi.fn(), claim: vi.fn(), originals: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({ authorizeArtistKnowledge: vi.fn() }));
vi.mock("@/lib/ownership/findApprovedClaim", () => ({ findApprovedClaim: m.claim }));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.originals,
}));
const ref = {
  sourceId: "vault:source",
  revision: "revision",
  start: 0,
  end: 6,
  text: "Answer",
  curation: "approved",
};
beforeEach(() => {
  vi.resetAllMocks();
  m.claim.mockResolvedValue(null);
  m.originals.mockResolvedValue([ref]);
});
it.each(["complete", "unresolved"])(
  "retains quota context for a saved-only %s result while revalidating originals",
  async stage => {
    m.execute.mockResolvedValue([
      {
        status: "done",
        updated_at: new Date().toISOString(),
        state: {
          version: 1,
          savedOnly: true,
          key: "key",
          expectedClaimId: null,
          request: { topic: "known original", evidenceNeed: "reporting", freshness: "stored" },
          stage,
          createdAt: new Date().toISOString(),
          references: [ref],
          limitations: [],
          modelCalls: 1,
          providerCalls: 0,
          inputTokens: 1,
          outputTokens: 1,
        },
      },
    ]);
    expect(await getQuestionResearchStatus("artist", "job", { kind: "service" })).toMatchObject({
      stage,
      outsideResearchReason: "quota",
      provider: null,
      references: [ref],
    });
    m.originals.mockResolvedValue([]);
    expect(await getQuestionResearchStatus("artist", "job", { kind: "service" })).toMatchObject({
      stage: "unresolved",
      outsideResearchReason: "quota",
      references: [],
    });
  },
);
