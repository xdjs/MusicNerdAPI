import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { getOrDraftResearchAnswer } from "@/lib/questionResearch/getOrDraftResearchAnswer";
import { getResearchQuestionHash } from "@/lib/questionResearch/getResearchQuestionHash";
const m = vi.hoisted(() => ({ execute: vi.fn(), draft: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
vi.mock("@/lib/questionResearch/draftResearchAnswer", () => ({ draftResearchAnswer: m.draft }));
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const ref = {
  sourceId: "vault:33333333-3333-4333-8333-333333333333",
  revision: "a".repeat(64),
  start: 10,
  end: 27,
  text: "I played the drums",
  url: "https://artist.example/interview",
  curation: "approved" as const,
  evidenceKind: "original_text" as const,
  speaker: "unverified" as const,
  publishedAt: null,
  retrievedAt: null,
  truncated: false,
};
const source = {
  n: 1,
  title: "artist.example",
  url: ref.url,
  sourceId: ref.sourceId,
  revision: ref.revision,
  start: 0,
  end: 50,
  curation: ref.curation,
  evidenceKind: ref.evidenceKind,
};
const result = {
  answer: "They played the drums. [1]",
  sources: [source],
  instagramMentions: [],
  fromOpenWeb: false,
  webDomains: [],
  suggestions: [],
};
const input = {
  artistId: "11111111-1111-4111-8111-111111111111",
  artistName: "Artist",
  jobId: "22222222-2222-4222-8222-222222222222",
  question: "Who played drums?",
  references: [ref],
};
const saved = {
  ...result,
  basis: [
    {
      sourceId: ref.sourceId,
      revision: ref.revision,
      start: ref.start,
      end: ref.end,
      url: ref.url,
      textHash: hash(ref.text),
      publishedAt: ref.publishedAt,
    },
  ],
};
const waiting = {
  artist_id: input.artistId,
  question_hash: getResearchQuestionHash(input.question),
  status: "waiting",
  claim_until: new Date(0).toISOString(),
  attempts: 0,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.draft.mockResolvedValue(result);
});
it("saves the first checked answer and returns it unchanged on a later poll", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([waiting])
    .mockResolvedValueOnce([{ claim_token: "token" }])
    .mockResolvedValueOnce([{ job_id: input.jobId }]);
  expect(await getOrDraftResearchAnswer(input)).toEqual({ state: "ready", result });
  const commit = renderSql(m.execute.mock.calls[3][0]);
  expect(commit.text).toContain("set status='verified'");
  expect(commit.text).toContain("state->>'stage'='complete'");
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...waiting, status: "verified", result: saved }]);
  expect(await getOrDraftResearchAnswer(input)).toEqual({ state: "ready", result });
  expect(m.draft).toHaveBeenCalledTimes(1);
});
it("does not launch another draft while a concurrent poller owns the lease", async () => {
  m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([
    {
      ...waiting,
      status: "drafting",
      claim_until: new Date(Date.now() + 60_000).toISOString(),
      attempts: 1,
    },
  ]);
  expect(await getOrDraftResearchAnswer(input)).toEqual({ state: "drafting" });
  expect(m.draft).not.toHaveBeenCalled();
});
it("withholds a cached answer if the API no longer considers its original eligible", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...waiting, status: "verified", result: saved }]);
  expect(await getOrDraftResearchAnswer({ ...input, references: [] })).toEqual({
    state: "unavailable",
  });
  expect(m.draft).not.toHaveBeenCalled();
});
it("records a safe draft failure without returning or replacing a verified answer", async () => {
  m.draft.mockRejectedValue(
    Object.assign(new Error("private model details"), { verificationStage: "claim_check" }),
  );
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([waiting])
    .mockResolvedValueOnce([{ claim_token: "token" }])
    .mockResolvedValueOnce([]);
  expect(await getOrDraftResearchAnswer(input)).toEqual({
    state: "failed",
    stage: "claim_check",
    retryable: true,
  });
  const failure = renderSql(m.execute.mock.calls[3][0]);
  expect(failure.text).toContain("set status='failed'");
  expect(JSON.stringify(failure.params)).not.toContain("private model details");
  expect(m.draft).toHaveBeenCalledTimes(1);
});
it("rejects an unregistered question before any model call", async () => {
  m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  expect(await getOrDraftResearchAnswer({ ...input, question: "A different question?" })).toEqual({
    state: "unregistered",
  });
  expect(m.draft).not.toHaveBeenCalled();
});
it("withholds a cached answer when date metadata changes without changing original text", async () => {
  m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([
    {
      ...waiting,
      status: "verified",
      result: { ...saved, basis: saved.basis.map(b => ({ ...b, publishedAt: "2026-10-05" })) },
    },
  ]);
  expect(
    await getOrDraftResearchAnswer({
      ...input,
      references: [{ ...ref, publishedAt: "2026-10-06" }],
    }),
  ).toEqual({
    state: "unavailable",
  });
});
it("stops polling when the final drafting lease expired without a recorded outcome", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...waiting, status: "drafting", attempts: 3 }])
    .mockResolvedValueOnce([]);
  expect(await getOrDraftResearchAnswer(input)).toEqual({
    state: "failed",
    stage: "draft",
    retryable: false,
  });
  expect(m.draft).not.toHaveBeenCalled();
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("selects the existing legacy registration and keeps its hash for lease and verified writes", async () => {
  const legacy = hash(input.question);
  const queries: ReturnType<typeof renderSql>[] = [];
  m.execute.mockImplementation(async (query: Parameters<typeof renderSql>[0]) => {
    const compiled = renderSql(query);
    queries.push(compiled);
    if (compiled.text.includes("select artist_id")) {
      expect(compiled.params).toContain(legacy);
      expect(compiled.params).toContain(getResearchQuestionHash(input.question));
      return [{ ...waiting, question_hash: legacy, attempts: 2 }];
    }
    if (compiled.text.includes("set status='drafting'")) return [{ claim_token: "token" }];
    if (compiled.text.includes("set status='verified'")) return [{ job_id: input.jobId }];
    return [];
  });
  expect((await getOrDraftResearchAnswer(input)).state).toBe("ready");
  const writes = queries.filter(q => /update artist_question_answers/.test(q.text));
  expect(writes).toHaveLength(2);
  for (const query of writes) {
    expect(query.params).toContain(legacy);
    expect(query.params).not.toContain(getResearchQuestionHash(input.question));
  }
});
it("read-only lookup cannot draft or strand an abandoned waiting answer", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ ...waiting, question_hash: "a".repeat(64) }]);
  expect(
    await getOrDraftResearchAnswer({ ...input, readOnlyQuestionHash: "a".repeat(64) }),
  ).toEqual({
    state: "unavailable",
  });
  expect(m.draft).not.toHaveBeenCalled();
  expect(m.execute).toHaveBeenCalledTimes(2);
});
it("keeps a recently acknowledged question in its existing answer lane before the browser resumes it", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { ...waiting, question_hash: "a".repeat(64), claim_until: new Date().toISOString() },
    ]);
  expect(
    await getOrDraftResearchAnswer({ ...input, readOnlyQuestionHash: "a".repeat(64) }),
  ).toEqual({
    state: "drafting",
  });
});
it.each(["verified", "drafting"])(
  "resumes a marked candidate continuation before returning a %s answer or spending another attempt",
  async status => {
    m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        ...waiting,
        status,
        result: { ...saved, sources: [], basis: [] },
        attempts: 3,
        failure_stage: "candidate_continuation",
      },
    ]);
    expect(await getOrDraftResearchAnswer(input)).toEqual({ state: "continuing" });
    expect(m.draft).not.toHaveBeenCalled();
  },
);
it("persists stable citation 1 and 3 bases when a duplicate original 2 is omitted", async () => {
  const third = {
    ...ref,
    sourceId: "vault:44444444-4444-4444-8444-444444444444",
    url: "https://artist.example/second",
    text: "I wrote the song",
    start: 0,
    end: 16,
  };
  const selected = [ref, { ...ref }, third];
  const cited = [source, { ...source, n: 3, sourceId: third.sourceId, url: third.url }];
  const checked = {
    ...result,
    answer: "They played drums and wrote the song. [1, 3]",
    sources: cited,
  };
  m.draft.mockResolvedValue(checked);
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([waiting])
    .mockResolvedValueOnce([{ claim_token: "token" }])
    .mockResolvedValueOnce([{ job_id: input.jobId }]);
  expect(await getOrDraftResearchAnswer({ ...input, references: selected })).toEqual({
    state: "ready",
    result: checked,
  });
  const stored = JSON.parse(
    renderSql(m.execute.mock.calls[3][0]).params.find(
      (p): p is string => typeof p === "string" && p.includes('"basis"'),
    )!,
  );
  expect(
    stored.basis.map((b: { sourceId: string; textHash: string }) => [b.sourceId, b.textHash]),
  ).toEqual([
    [ref.sourceId, hash(ref.text)],
    [third.sourceId, hash(third.text)],
  ]);
});
