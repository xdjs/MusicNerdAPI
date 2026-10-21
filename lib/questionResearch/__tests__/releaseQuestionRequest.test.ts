import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { releaseQuestionRequest } from "@/lib/questionResearch/releaseQuestionRequest";
const m = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { execute: m.execute } }));
beforeEach(() => {
  vi.resetAllMocks();
  m.execute.mockResolvedValue([]);
});
it("deletes only this token's unbound lease, never a binding", async () => {
  await releaseQuestionRequest("artist", "hash", "token");
  const { text, params } = renderSql(m.execute.mock.calls[0][0]);
  expect(text).toMatch(/delete from artist_question_requests where .* and job_id is null/);
  expect(params).toEqual(["artist", "hash", "token"]);
});
