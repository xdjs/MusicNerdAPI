import { beforeEach, expect, it, vi } from "vitest";
import { getResearchEvidenceHandler } from "../getResearchEvidenceHandler";
import { researchSourceIdSchema } from "../researchOutputSchemas";
const m = vi.hoisted(() => ({ auth: vi.fn(), publicRead: vi.fn(), discoveryRead: vi.fn() }));
vi.mock("@/lib/questionResearch/authenticateResearchRequest", () => ({
  authenticateResearchRequest: m.auth,
}));
vi.mock("@/lib/questionResearch/readPublicResearchSource", () => ({
  readPublicResearchSource: m.publicRead,
}));
vi.mock("@/lib/questionResearch/readResearchEvidence", () => ({
  readResearchEvidence: m.discoveryRead,
}));
const artist = "11111111-1111-4111-8111-111111111111";
const answer = "22222222-2222-4222-8222-222222222222";
const revision = "a".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ kind: "service" });
  m.publicRead.mockResolvedValue({ status: "ok", passage: { text: "Published answer" } });
});
it("accepts published answer reference IDs and reads them through current public eligibility", async () => {
  const sourceId = `public_answer:${answer}`;
  expect(researchSourceIdSchema.safeParse(sourceId).success).toBe(true);
  const response = await getResearchEvidenceHandler(
    new Request(`https://api.example?revision=${revision}&start=2&maxChars=256`),
    artist,
    sourceId,
  );
  expect(response.status).toBe(200);
  expect(m.publicRead).toHaveBeenCalledWith(artist, sourceId, revision, 2, 256);
  expect(m.discoveryRead).not.toHaveBeenCalled();
});
it("does not turn arbitrary interview source identifiers into public reads", async () => {
  const response = await getResearchEvidenceHandler(
    new Request(`https://api.example?revision=${revision}`),
    artist,
    `interview:${answer}`,
  );
  expect(response.status).toBe(400);
  expect(m.publicRead).not.toHaveBeenCalled();
  expect(m.discoveryRead).not.toHaveBeenCalled();
});
