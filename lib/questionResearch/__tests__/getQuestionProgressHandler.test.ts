import { beforeEach, expect, it, vi } from "vitest";
import { getQuestionProgressHandler } from "@/lib/questionResearch/getQuestionProgressHandler";
const m = vi.hoisted(() => ({ status: vi.fn(), advance: vi.fn() }));
vi.mock("@/lib/questionResearch/getQuestionResearchStatus", () => ({
  getQuestionResearchStatus: m.status,
}));
vi.mock("@/lib/research/advanceResearch", () => ({ advanceResearch: m.advance }));
const id = "11111111-1111-4111-8111-111111111111",
  jobId = "22222222-2222-4222-8222-222222222222";
const get = () => new Request(`https://api.example/api/artist/${id}/questionResearch/${jobId}`);
const state = (stage: string) => ({
  status: "ok",
  jobId,
  stage,
  provider: stage === "reading" ? "web" : null,
  message: `at ${stage}`,
  updatedAt: "2026-10-21T00:00:00.000Z",
  references: [
    {
      sourceId: "vault:33333333-3333-4333-8333-333333333333",
      revision: "a".repeat(64),
      start: 0,
      end: 4,
      text: "text",
      url: "https://example.com/a",
      curation: "approved",
      evidenceKind: "original_text",
      speaker: "not_applicable",
      publishedAt: null,
      retrievedAt: null,
      truncated: null,
    },
  ],
  limitations: ["private limitation"],
});
beforeEach(() => {
  vi.resetAllMocks();
  m.advance.mockResolvedValue({ ran: true });
});
it("returns only Web's progress fields for a terminal job, without advancing", async () => {
  m.status.mockResolvedValue(state("complete"));
  const r = await getQuestionProgressHandler(get(), id, jobId);
  expect(r.status).toBe(200);
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await r.json()).toEqual({
    status: "ok",
    jobId,
    stage: "complete",
    provider: null,
    message: "at complete",
    retryAfterMs: 5000,
  });
  expect(m.status).toHaveBeenCalledWith(id, jobId, { kind: "service" });
  expect(m.advance).not.toHaveBeenCalled();
});
it("advances one question-research slice for the artist, then reads the job again", async () => {
  m.status.mockResolvedValueOnce(state("searching")).mockResolvedValueOnce(state("reading"));
  const r = await getQuestionProgressHandler(get(), id, jobId);
  expect(m.advance).toHaveBeenCalledWith(
    expect.objectContaining({ artistId: id, kinds: ["question_research"] }),
  );
  expect(m.advance.mock.calls[0][0].budgetMs).toBeLessThanOrEqual(56000);
  expect(m.status).toHaveBeenCalledTimes(2);
  expect(await r.json()).toMatchObject({ stage: "reading", provider: "web" });
});
it("still reports progress when the slice fails, as Web's advance route answered 200", async () => {
  m.status.mockResolvedValue(state("searching"));
  m.advance.mockRejectedValue(new Error("db down"));
  const r = await getQuestionProgressHandler(get(), id, jobId);
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ stage: "searching" });
});
it("rejects a non-UUID artist or job with Web's 400", async () => {
  const r = await getQuestionProgressHandler(get(), id, "nope");
  expect(r.status).toBe(400);
  expect(await r.json()).toEqual({ status: "error", error: "Invalid research job" });
  expect(m.status).not.toHaveBeenCalled();
});
it("answers a thrown database error or unknown job with Web's JSON 503 and CORS", async () => {
  m.status.mockRejectedValue(new Error("connection refused"));
  const r = await getQuestionProgressHandler(get(), id, jobId);
  expect(r.status).toBe(503);
  expect(r.headers.get("Access-Control-Allow-Origin")).toBe("*");
  expect(await r.json()).toEqual({
    status: "error",
    error: "Research could not be checked. The saved job can be resumed.",
  });
});
