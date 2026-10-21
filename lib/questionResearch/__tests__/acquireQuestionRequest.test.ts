import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { acquireQuestionRequest } from "@/lib/questionResearch/acquireQuestionRequest";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
const artist = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64);
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
});
it("claims a short lease under the index lock after pruning expired rows", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  const result = await acquireQuestionRequest(artist, hash);
  expect(result.state).toBe("claimed");
  expect(result).toMatchObject({ token: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  const [lock, prune, select, upsert] = m.execute.mock.calls.map(c => renderSql(c[0]));
  expect(lock.text).toContain(
    "pg_advisory_xact_lock(hashtext('musicnerd-question-request-index'))",
  );
  expect(prune.text).toMatch(/delete from artist_question_requests where expires_at<now\(\)/);
  expect(select.params).toEqual([artist, hash]);
  expect(upsert.text).toContain("on conflict(artist_id,request_hash) do update");
  expect(upsert.text).toContain("job_id=null,question_hash=null,reusable=false");
});
it("reports an active lease as busy without touching it", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      { token: "t", job_id: null, question_hash: null, reusable: false, busy: true },
    ]);
  expect(await acquireQuestionRequest(artist, hash)).toEqual({ state: "busy" });
  expect(m.execute).toHaveBeenCalledTimes(3);
});
it("returns an existing binding unless the caller invalidates that exact token", async () => {
  const binding = { token: "old", job_id: "j", question_hash: hash, reusable: true, busy: false };
  m.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([binding]);
  expect(await acquireQuestionRequest(artist, hash)).toEqual({ state: "bound", binding });
  m.execute
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([binding])
    .mockResolvedValueOnce([]);
  expect((await acquireQuestionRequest(artist, hash, "old")).state).toBe("claimed");
  m.execute
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([binding]);
  expect((await acquireQuestionRequest(artist, hash, "other")).state).toBe("bound");
});
