import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { bindQuestionRequest } from "@/lib/questionResearch/bindQuestionRequest";
import { getResearchQuestionHash } from "@/lib/questionResearch/getResearchQuestionHash";
const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
const input = {
  artistId: "11111111-1111-4111-8111-111111111111",
  requestHash: "a".repeat(64),
  token: "22222222-2222-4222-8222-222222222222",
  jobId: "33333333-3333-4333-8333-333333333333",
  question: "Who played drums?",
  reusable: true,
  answerIntent: "Drum credit",
  routing: { topic: "drums" },
};
beforeEach(() => vi.resetAllMocks());
it("persists digests and routing only while this token still holds the lease", async () => {
  m.execute.mockResolvedValueOnce([{ token: input.token }]);
  await bindQuestionRequest(input);
  const { text, params } = renderSql(m.execute.mock.calls[0][0]);
  expect(text).toMatch(/update artist_question_requests set job_id=\$1::uuid/);
  expect(text).toContain("token=$8::uuid and lease_until>now() and expires_at>now()");
  expect(params).toEqual([
    input.jobId,
    getResearchQuestionHash(input.question),
    true,
    "Drum credit",
    JSON.stringify(input.routing),
    input.artistId,
    input.requestHash,
    input.token,
  ]);
});
it("keeps a supplied question hash and fails when the lease expired", async () => {
  m.execute.mockResolvedValueOnce([]);
  await expect(bindQuestionRequest({ ...input, questionHash: "b".repeat(64) })).rejects.toThrow(
    "Request binding lease expired",
  );
  expect(renderSql(m.execute.mock.calls[0][0]).params).toContain("b".repeat(64));
});
