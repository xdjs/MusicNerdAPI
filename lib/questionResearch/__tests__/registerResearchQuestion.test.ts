import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { registerResearchQuestion } from "@/lib/questionResearch/registerResearchQuestion";
import { getResearchQuestionHash } from "@/lib/questionResearch/getResearchQuestionHash";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
const artist = "11111111-1111-4111-8111-111111111111";
const job = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
});
it("registers the exact question digest under a job lock before acknowledging it", async () => {
  m.execute
    .mockResolvedValueOnce([]) // advisory transaction lock
    .mockResolvedValueOnce([]) // expiry cleanup
    .mockResolvedValueOnce([]) // unknown question
    .mockResolvedValueOnce([{ n: 2 }])
    .mockResolvedValueOnce([{ job_id: job }]);
  expect(await registerResearchQuestion(artist, job, "Who played drums?")).toBe(true);
  expect(m.execute).toHaveBeenCalledTimes(5);
  const insert = renderSql(m.execute.mock.calls[4][0]);
  expect(insert.text).toContain("insert into artist_question_answers");
  expect(insert.text).toContain("kind='question_research'");
  expect(insert.params).toContain(getResearchQuestionHash("Who played drums?"));
});
it("stops a fourth distinct question before any insert or model draft", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ n: 3 }]);
  expect(await registerResearchQuestion(artist, job, "A fourth question?")).toBe(false);
  expect(m.execute).toHaveBeenCalledTimes(4);
});
it("acknowledges an already registered question without spending a slot", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ "?column?": 1 }]);
  expect(await registerResearchQuestion(artist, job, "Who played drums?")).toBe(true);
  expect(m.execute).toHaveBeenCalledTimes(3);
});
