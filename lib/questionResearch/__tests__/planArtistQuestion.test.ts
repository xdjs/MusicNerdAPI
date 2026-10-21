import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planArtistQuestion } from "@/lib/questionResearch/planArtistQuestion";
const m = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generate }));
vi.mock("ai", () => ({ Output: { object: vi.fn() } }));
const output = (over: Record<string, unknown> = {}) => ({
  output: {
    topic: "Record drum credits",
    evidenceNeed: "credits",
    freshness: "stored",
    platform: null,
    targetUrl: null,
    fromDate: null,
    toDate: null,
    ...over,
  },
});
beforeEach(() => vi.resetAllMocks());
it("keeps the neutral public evidence request and strips absent optional routing fields", async () => {
  m.generate.mockResolvedValue(output());
  expect(await planArtistQuestion("Artist", "Who played drums?")).toEqual({
    topic: "Record drum credits",
    evidenceNeed: "credits",
    freshness: "stored",
    reuseAction: "none",
    retrieval: "relevance",
    answerScope: "focused",
    resolvedQuestion: "Who played drums?",
  });
  expect(m.generate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "google/gemini-3.8-flash",
      thinkingLevel: "low",
      maxRetries: 0,
    }),
  );
});
it("never accepts a model-invented original URL that was not in the question", async () => {
  m.generate.mockResolvedValue(output({ targetUrl: "https://made-up.example/source" }));
  await expect(planArtistQuestion("Artist", "Who played drums?")).rejects.toThrow(/URL/);
});
it("does not invent a recent-only filter and routes newest posts without a seven-day cutoff", async () => {
  m.generate.mockResolvedValue(
    output({
      evidenceNeed: "social_caption",
      freshness: "recent",
      retrieval: "latest",
      resolvedQuestion: "What is the latest Instagram post?",
      platform: "instagram",
    }),
  );
  expect(await planArtistQuestion("Artist", "What is the latest Instagram post?")).toMatchObject({
    retrieval: "latest",
    freshness: "stored",
    platform: "instagram",
  });
});
it("resolves a follow-up with bounded public conversation without treating it as evidence", async () => {
  m.generate.mockResolvedValue(
    output({
      retrieval: "relevance",
      resolvedQuestion: "Who created LATASHA's PPNE NYC visualizer?",
    }),
  );
  const conversation = [
    { question: "What was that post about?", answer: "It discussed the PPNE NYC visualizer." },
  ];
  const plan = await planArtistQuestion("LATASHA", "Who created it?", undefined, conversation);
  expect(plan).toMatchObject({ resolvedQuestion: "Who created LATASHA's PPNE NYC visualizer?" });
  expect(JSON.parse(m.generate.mock.calls.at(-1)![0].prompt as string)).toMatchObject({
    conversation,
  });
});
it("allows an exact cited original for a matching follow-up but not a URL merely in prose", async () => {
  const sourceUrl = "https://www.instagram.com/p/example-original/";
  m.generate.mockResolvedValue(
    output({
      resolvedQuestion: "Who filmed the rooftop visualizer?",
      targetUrl: sourceUrl,
      platform: "instagram",
    }),
  );
  expect(
    await planArtistQuestion("Artist", "Who filmed it?", undefined, [
      {
        question: "What is this post about?",
        answer: "The rooftop visualizer.",
        sourceUrls: [sourceUrl],
      },
    ]),
  ).toMatchObject({ targetUrl: sourceUrl });
  const prose = "https://untrusted.example/work";
  m.generate.mockResolvedValue(
    output({ resolvedQuestion: "Who filmed the visualizer?", targetUrl: prose }),
  );
  await expect(
    planArtistQuestion("Artist", "Who filmed it?", undefined, [
      { question: "What post?", answer: `See ${prose}` },
    ]),
  ).rejects.toThrow(/URL/);
});
it.each([
  ["What did Pete post most recently on InProcess?", "inprocess"],
  ["What is the latest Spotify release?", "spotify"],
])(
  "preserves explicit platform even when the model picks a different provider: %s",
  async (question, platform) => {
    m.generate.mockResolvedValue(
      output({
        evidenceNeed: "social_caption",
        freshness: "recent",
        retrieval: "latest",
        platform: "tiktok",
      }),
    );
    expect(await planArtistQuestion("Artist", question)).toMatchObject({
      platform,
      retrieval: "latest",
      freshness: "stored",
    });
  },
);
it("does not invent a platform restriction for a broad latest overview", async () => {
  m.generate.mockResolvedValue(output({ retrieval: "latest", platform: "tiktok" }));
  expect(await planArtistQuestion("Artist", "What is the latest?")).not.toHaveProperty("platform");
});
it("keeps a broader recent-activity follow-up recent and excludes already discussed sources", async () => {
  const url = "https://www.inprocess.world/collect/base:example/2";
  m.generate.mockResolvedValue(
    output({
      topic: "Pete Rango other projects",
      followupMode: "other_activity",
      evidenceNeed: "reporting",
      retrieval: "relevance",
      resolvedQuestion: "What other projects has Pete Rango been working on?",
      targetUrl: url,
      platform: "inprocess",
    }),
  );
  const result = await planArtistQuestion("Pete Rango", "what else has he been up to?", undefined, [
    {
      question: "What's Pete Rango's latest project?",
      answer: "Plugin designs.",
      sourceUrls: [url],
    },
  ]);
  expect(result).toMatchObject({
    retrieval: "latest",
    freshness: "stored",
    excludeSourceUrls: [url],
  });
  expect(result).not.toHaveProperty("targetUrl");
  expect(result).not.toHaveProperty("platform");
});
it("normalizes artist possessives so the same topic can reuse its saved job", async () => {
  m.generate.mockResolvedValue(
    output({ topic: "Artist's latest project", evidenceNeed: "reporting", retrieval: "latest" }),
  );
  expect(await planArtistQuestion("Artist", "What's Artist's latest project?")).toMatchObject({
    topic: "Artist latest project",
  });
});
it("returns a clarification and drops reuse when the model cannot resolve context", async () => {
  m.generate.mockResolvedValue(
    output({ contextResolved: false, reuseCandidateId: "c", reuseAction: "same_answer" }),
  );
  expect(await planArtistQuestion("Artist", "Who produced it?")).toEqual({
    clarification: "Which song, release, or post do you mean?",
  });
});
describe("dated originals and pasted source URLs", () => {
  const url = "https://www.instagram.com/p/DeH-zaDygKO/";
  const dated = {
    topic: "PPNE caption choices",
    evidenceNeed: "social_caption",
    resolvedQuestion: "Which choices appear in the October 7 caption?",
    targetUrl: url,
    platform: "instagram",
    fromDate: "2023-10-07",
    toDate: "2023-10-07",
  };
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-10-13T12:00:00Z"), toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());
  it("uses the clock for a yearless date and drops the older citation", async () => {
    m.generate.mockResolvedValue(output(dated));
    const plan = await planArtistQuestion(
      "LATASHA",
      "In her October 7 Instagram caption, which versions of PPNE does she ask listeners to choose between?",
      undefined,
      [{ question: "What's latest?", answer: "October 5 PPNE visualizer", sourceUrls: [url] }],
    );
    expect(plan).toMatchObject({
      fromDate: "2026-10-07",
      toDate: "2026-10-07",
      platform: "instagram",
    });
    expect(plan).not.toHaveProperty("targetUrl");
    expect(JSON.parse(m.generate.mock.calls.at(-1)![0].prompt as string).currentDate).toBe(
      "2026-10-13",
    );
  });
  it.each([",", ".", ")"])("accepts a literal URL followed by %s", async punctuation => {
    m.generate.mockResolvedValue(output({ ...dated, fromDate: null, toDate: null }));
    expect(
      await planArtistQuestion("LATASHA", `According to (${url}${punctuation} who filmed PPNE?`),
    ).toMatchObject({
      targetUrl: url,
    });
  });
});
it("does not turn an event date into an unrequested source window", async () => {
  const question = "Why was the concert recorded on June 14, 2024?";
  m.generate.mockResolvedValue(output({ evidenceNeed: "reporting" }));
  const plan = await planArtistQuestion("Artist", question);
  expect(plan).not.toHaveProperty("fromDate");
  expect(plan).toMatchObject({ resolvedQuestion: question });
});
it("reports a local planning deadline without logging source text or raw provider errors", async () => {
  const timeout = new AbortController();
  const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    m.generate.mockImplementation(async () => {
      timeout.abort(new DOMException("Timed out", "TimeoutError"));
      throw Object.assign(new Error("PRIVATE provider body and question"), {
        name: "GatewayResponseError",
        statusCode: 504,
      });
    });
    await expect(planArtistQuestion("PRIVATE artist", "PRIVATE question")).rejects.toThrow();
    expect(warn).toHaveBeenLastCalledWith(
      "[questionResearch] planning failed",
      expect.objectContaining({
        stage: "plan_generate",
        category: "deadline_exceeded",
        candidateCount: 0,
      }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE");
  } finally {
    timeoutSpy.mockRestore();
    warn.mockRestore();
  }
});
it("distinguishes schema parsing failures from planning deadlines without logging content", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    m.generate.mockResolvedValue({ output: { topic: "PRIVATE invalid output" } });
    await expect(planArtistQuestion("Artist", "PRIVATE question")).rejects.toThrow();
    expect(warn).toHaveBeenLastCalledWith(
      "[questionResearch] planning failed",
      expect.objectContaining({ stage: "plan_parse", category: "ZodError" }),
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE");
  } finally {
    warn.mockRestore();
  }
});
