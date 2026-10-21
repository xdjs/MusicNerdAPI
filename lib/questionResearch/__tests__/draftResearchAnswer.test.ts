import { beforeEach, expect, it, vi } from "vitest";
import { draftResearchAnswer } from "@/lib/questionResearch/draftResearchAnswer";
import type { ResearchReference } from "@/lib/questionResearch/publicQuestionSchemas";
const m = vi.hoisted(() => ({ generate: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/ai/generateText", () => ({ generateText: m.generate }));
vi.mock("@/lib/questionResearch/readResearchOriginal", () => ({ readResearchOriginal: m.read }));
vi.mock("ai", () => ({ Output: { object: vi.fn() } }));
const artistId = "11111111-1111-4111-8111-111111111111";
const reference: ResearchReference = {
  sourceId: "vault:11111111-1111-4111-8111-111111111111",
  revision: "a".repeat(64),
  start: 0,
  end: "I played drums. I did not produce it.".length,
  text: "I played drums. I did not produce it.",
  url: "https://artist.example/credits",
  curation: "pending",
  evidenceKind: "original_text",
  speaker: "unverified",
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
};
const draft = {
  sentences: [{ text: "They played drums.", evidence: [{ n: 1, quote: "I played drums." }] }],
  unanswered: null,
};
const passage = (p = reference) => ({
  status: "ok",
  passage: p,
  totalChars: p.text.length,
  nextStart: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  m.read.mockResolvedValue(passage());
  m.generate
    .mockResolvedValueOnce({ output: draft })
    .mockResolvedValueOnce({ output: { supported: true, reason: "Drums only." } });
});
it("reopens the original in process before drafting and retains exact references with pending curation", async () => {
  const result = await draftResearchAnswer(artistId, "Artist", "What did they play?", [reference]);
  expect(m.read).toHaveBeenCalledWith(
    artistId,
    { kind: "service" },
    reference.sourceId,
    reference.revision,
    0,
    reference.text.length + 1200,
  );
  expect(m.generate.mock.calls[0][0].prompt).toContain("I did not produce it.");
  expect(result.answer).toBe("They played drums. [1]");
  expect(result.sources[0]).toMatchObject({
    sourceId: reference.sourceId,
    revision: reference.revision,
    curation: "pending",
  });
  expect(result.fromOpenWeb).toBe(true);
});
it("shares one read across identical windows and keeps the original citation when whitespace collapses", async () => {
  const text =
    "Dutchyyy has been building it out  over the past year\n\nto escape platform dependency & reach listeners.";
  const spaced = { ...reference, text, end: text.length };
  m.read.mockResolvedValue(passage(spaced));
  m.generate
    .mockReset()
    .mockResolvedValueOnce({
      output: {
        sentences: [
          {
            text: "The vault helps him escape platform dependency.",
            evidence: [
              { n: 1, quote: "building it out over the past year to escape platform dependency" },
            ],
          },
        ],
        unanswered: null,
      },
    })
    .mockResolvedValueOnce({ output: { supported: true, reason: "Passage establishes purpose." } });
  const result = await draftResearchAnswer(artistId, "Dutchyyy", "Why the vault?", [
    spaced,
    { ...spaced },
  ]);
  expect(m.read).toHaveBeenCalledTimes(1);
  expect(result.answer).toBe("The vault helps him escape platform dependency. [1]");
  expect(result.sources).toHaveLength(1);
});
it("withholds unknown or fabricated quote references before checking a claim", async () => {
  m.generate.mockReset().mockResolvedValue({
    output: {
      sentences: [{ text: "They produced it.", evidence: [{ n: 1, quote: "I produced it." }] }],
      unanswered: null,
    },
  });
  await expect(
    draftResearchAnswer(artistId, "Artist", "Who produced it?", [reference]),
  ).rejects.toMatchObject({
    verificationCode: "quote_rejected",
    verificationStage: "quote_check",
  });
  expect(m.generate).toHaveBeenCalledTimes(2);
});
it("does not draft after an original becomes unavailable, changes, or has inconsistent offsets", async () => {
  m.read.mockRejectedValue(new Error("revision changed"));
  await expect(draftResearchAnswer(artistId, "Artist", "Who?", [reference])).rejects.toThrow();
  m.read.mockResolvedValue(passage({ ...reference, publishedAt: "2026-10-06" }));
  await expect(
    draftResearchAnswer(artistId, "Artist", "Latest?", [
      { ...reference, publishedAt: "2026-10-05" },
    ]),
  ).rejects.toMatchObject({ verificationCode: "original_mismatch" });
  m.read.mockResolvedValue({ ...passage(), passage: { ...reference, end: 900 }, totalChars: 900 });
  await expect(draftResearchAnswer(artistId, "Artist", "What?", [reference])).rejects.toThrow(
    /evidence/i,
  );
  expect(m.generate).not.toHaveBeenCalled();
});
it("records a safe failure stage without logging source text, questions or model errors", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  m.generate.mockReset().mockRejectedValue(new Error("PRIVATE PROVIDER PAYLOAD"));
  await expect(
    draftResearchAnswer(artistId, "Artist", "PRIVATE QUESTION", [reference]),
  ).rejects.toThrow();
  expect(warning).toHaveBeenCalledWith("[questionResearch] answer verification failed", {
    stage: "draft",
    category: "operation_failed",
    status: null,
    finishReason: null,
  });
  expect(JSON.stringify(warning.mock.calls)).not.toMatch(/PRIVATE|played drums/);
  warning.mockRestore();
});
it("accepts a source publication date only as exact typed metadata evidence", async () => {
  const dated = { ...reference, publishedAt: "2026-10-05T19:43:02.000Z" };
  m.read.mockResolvedValue(passage(dated));
  m.generate
    .mockReset()
    .mockResolvedValueOnce({
      output: {
        sentences: [
          {
            text: "In a post published October 5, they said they played drums.",
            evidence: [
              { n: 1, field: "publishedAt", quote: dated.publishedAt },
              { n: 1, field: "text", quote: "I played drums." },
            ],
          },
        ],
        unanswered: null,
      },
    })
    .mockResolvedValueOnce({
      output: { supported: true, reason: "Date metadata and exact drums statement." },
    });
  expect((await draftResearchAnswer(artistId, "Artist", "Latest?", [dated])).answer).toContain(
    "published October 5",
  );
  m.generate.mockReset().mockResolvedValue({
    output: {
      sentences: [
        {
          text: "Published October 6.",
          evidence: [{ n: 1, field: "publishedAt", quote: "2026-10-06T19:43:02.000Z" }],
        },
      ],
      unanswered: null,
    },
  });
  await expect(draftResearchAnswer(artistId, "Artist", "Latest?", [dated])).rejects.toThrow(
    /evidence/i,
  );
});
it("bounds structured drafting and checking without hidden thinking or provider retries", async () => {
  await draftResearchAnswer(artistId, "Artist", "What did they play?", [reference]);
  expect(m.generate).toHaveBeenCalledTimes(2);
  expect(m.generate.mock.calls[0][0]).toMatchObject({
    model: "anthropic/claude-sonnet-5.5",
    anthropicEffort: "low",
    maxRetries: 0,
  });
  expect(m.generate.mock.calls[1][0]).toMatchObject({
    model: "anthropic/claude-sonnet-5.5",
    maxRetries: 0,
    maxOutputTokens: 1500,
  });
  expect(m.generate.mock.calls[0][0]).not.toHaveProperty("temperature");
});
it("repairs rejected wording once using unchanged originals and rechecks the result", async () => {
  const wrong = {
    ...draft,
    sentences: [{ ...draft.sentences[0], text: "Their latest post says they played drums." }],
  };
  m.generate
    .mockReset()
    .mockResolvedValueOnce({ output: wrong })
    .mockResolvedValueOnce({ output: { supported: false, reason: "Unqualified latest claim." } })
    .mockResolvedValueOnce({ output: draft })
    .mockResolvedValueOnce({ output: { supported: true, reason: "Supported." } });
  const result = await draftResearchAnswer(artistId, "Artist", "What is latest?", [reference]);
  expect(result.answer).toBe("They played drums. [1]");
  expect(m.generate).toHaveBeenCalledTimes(4);
  expect(m.read).toHaveBeenCalledTimes(1);
  expect(JSON.parse(m.generate.mock.calls[2][0].prompt).repairFeedback).toMatchObject({
    reason: "Unqualified latest claim.",
  });
});
it("rejects an unsupported second draft without a third repair, keeping an independently supported subset", async () => {
  m.generate.mockReset();
  for (let i = 0; i < 2; i++)
    m.generate
      .mockResolvedValueOnce({ output: draft })
      .mockResolvedValueOnce({ output: { supported: false, reason: "Unsupported visual claim." } });
  await expect(draftResearchAnswer(artistId, "Artist", "What?", [reference])).rejects.toMatchObject(
    {
      verificationCode: "claim_rejected",
      verificationStage: "claim_check",
    },
  );
  const two = {
    sentences: [
      draft.sentences[0],
      { text: "They produced it.", evidence: [{ n: 1, quote: "I did not produce it." }] },
    ],
    unanswered: null,
  };
  m.generate
    .mockReset()
    .mockResolvedValueOnce({ output: two })
    .mockResolvedValueOnce({
      output: {
        supported: false,
        supportedSentenceNumbers: [1],
        reason: "Second sentence inverts the source.",
      },
    });
  expect((await draftResearchAnswer(artistId, "Artist", "What?", [reference])).answer).toBe(
    "They played drums. [1]",
  );
});
it("renders a fixed scoped limitation instead of model-written unanswered prose, and resolves cited Instagram handles", async () => {
  const post = {
    ...reference,
    sourceId: "social:22222222-2222-4222-8222-222222222222:caption",
    url: "https://www.instagram.com/p/real/",
    text: "Drums by @cxy on this one.",
    end: "Drums by @cxy on this one.".length,
  };
  m.read.mockResolvedValue(passage(post));
  m.generate
    .mockReset()
    .mockResolvedValueOnce({
      output: {
        sentences: [{ text: "@cxy played drums.", evidence: [{ n: 1, quote: "Drums by @cxy" }] }],
        unanswered: "There are no records anywhere about the release.",
      },
    })
    .mockResolvedValueOnce({ output: { supported: true, reason: "Supported." } });
  const result = await draftResearchAnswer(artistId, "Artist", "Who drummed, and when?", [post]);
  expect(result.answer).toBe("@cxy played drums. [1] I couldn’t confirm the other details.");
  expect(result.instagramMentions).toEqual(["cxy"]);
  expect(result.sources[0].title).toBe("www.instagram.com");
});
it("returns an honest empty answer when the model finds nothing to support", async () => {
  m.generate
    .mockReset()
    .mockResolvedValueOnce({ output: { sentences: [], unanswered: "Not covered." } });
  expect(await draftResearchAnswer(artistId, "Artist", "What?", [reference])).toEqual({
    answer: "I don't have enough information to answer that yet.",
    sources: [],
    instagramMentions: [],
    fromOpenWeb: false,
    webDomains: [],
    suggestions: [],
  });
  expect(m.generate).toHaveBeenCalledTimes(1);
});
