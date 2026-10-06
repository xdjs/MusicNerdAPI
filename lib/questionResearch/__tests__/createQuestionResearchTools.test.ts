import { it, expect, vi, afterEach } from "vitest";
import { createQuestionResearchTools } from "@/lib/questionResearch/createQuestionResearchTools";
const artistId = "11111111-1111-4111-8111-111111111111";
const config = {
  apiOrigin: "https://api.example",
  artistId,
  getHeaders: async () => ({ "X-MusicNerd-Research-Key": "server-only" }),
};
afterEach(() => vi.unstubAllGlobals());
it("binds the artist and credentials on the host, not in tool input", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json({
      status: "ok",
      jobId: artistId,
      stage: "checking_saved",
      provider: null,
      message: "Checking",
      updatedAt: new Date().toISOString(),
      references: [],
      limitations: [],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const tools = createQuestionResearchTools(config);
  expect(Object.keys(tools).sort()).toEqual([
    "getResearchStatus",
    "readArtistSource",
    "requestArtistResearch",
  ]);
  await tools.requestArtistResearch.execute!(
    { topic: "record credits", evidenceNeed: "credits", freshness: "stored" },
    { toolCallId: "call", messages: [], context: {} },
  );
  expect(fetch.mock.calls[0][0]).toBe(
    `https://api.example/api/artist/${artistId}/research/questions`,
  );
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    headers: expect.objectContaining({ "X-MusicNerd-Research-Key": "server-only" }),
  });
});
it("rejects an untrusted host URL before obtaining credentials", () => {
  expect(() =>
    createQuestionResearchTools({
      ...config,
      apiOrigin: "https://api.example/private?token=secret",
    }),
  ).toThrow();
});
it("propagates unavailable research as an error instead of empty evidence", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { status: "error", error: "Unavailable", code: "research_unavailable" },
        { status: 503 },
      ),
    ),
  );
  await expect(
    createQuestionResearchTools(config).getResearchStatus.execute!(
      { jobId: artistId },
      { toolCallId: "call", messages: [], context: {} },
    ),
  ).rejects.toThrow();
});

it("captures the host configuration so mutation cannot redirect artist scope", async () => {
  const local = { ...config };
  const tools = createQuestionResearchTools(local);
  local.artistId = "22222222-2222-4222-8222-222222222222";
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    Response.json({
      status: "ok",
      jobId: artistId,
      stage: "complete",
      provider: null,
      message: "Done",
      updatedAt: new Date().toISOString(),
      references: [],
      limitations: [],
    }),
  );
  vi.stubGlobal("fetch", fetch);
  await tools.getResearchStatus.execute!(
    { jobId: artistId },
    { toolCallId: "call", messages: [], context: {} },
  );
  expect(String(fetch.mock.calls[0][0])).toContain(`/artist/${artistId}/`);
});
it("rejects malformed successful responses rather than returning them as evidence", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ status: "ok" })));
  await expect(
    createQuestionResearchTools(config).getResearchStatus.execute!(
      { jobId: artistId },
      { toolCallId: "call", messages: [], context: {} },
    ),
  ).rejects.toThrow();
});
