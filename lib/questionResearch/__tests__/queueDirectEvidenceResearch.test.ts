import { beforeEach, expect, it, vi } from "vitest";
import { queueDirectEvidenceResearch } from "@/lib/questionResearch/queueDirectEvidenceResearch";
const m = vi.hoisted(() => ({
  queue: vi.fn(),
  artist: vi.fn(),
  originals: vi.fn(),
  select: vi.fn(),
}));
vi.mock("@/lib/questionResearch/queueQuestionResearch", () => ({ queueQuestionResearch: m.queue }));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.originals,
}));
vi.mock("@/lib/questionResearch/selectDirectResearchCandidates", () => ({
  selectDirectResearchCandidates: m.select,
}));
const artist = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.resetAllMocks();
  m.queue.mockResolvedValue({ status: "ok", jobId: "job" });
  m.artist.mockResolvedValue({ name: "Example" });
  m.originals.mockResolvedValue([]);
  m.select.mockReturnValue({ references: [] });
});
it("reads the public corpus before quota admission and queues as the service", async () => {
  const references = [{ sourceId: "vault:a" }];
  m.select.mockReturnValue({ references });
  const routing = {
    topic: "album credits",
    evidenceNeed: "credits" as const,
    freshness: "stored" as const,
  };
  expect(await queueDirectEvidenceResearch(artist, routing)).toEqual({
    status: "ok",
    jobId: "job",
  });
  expect(m.select).toHaveBeenCalledWith([], routing, "Example");
  expect(m.queue).toHaveBeenCalledWith(artist, { kind: "service" }, routing, {
    directCandidates: references,
  });
  expect(m.select.mock.invocationCallOrder[0]).toBeLessThan(m.queue.mock.invocationCallOrder[0]);
});
