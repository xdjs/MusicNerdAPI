import { beforeEach, expect, it, vi } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import { reserveQuestionPlanning } from "@/lib/questionResearch/reserveQuestionPlanning";
const m = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
const artist = "11111111-1111-4111-8111-111111111111";
const visitor = "a".repeat(64);
const nowMs = Date.parse("2026-10-21T12:00:00.000Z");
const usage = (over: Partial<Record<string, unknown>> = {}) => ({
  global: 0,
  visitor: 0,
  admitted_at: "2026-10-21 12:00:00+00",
  now_ms: nowMs,
  global_reset_ms: null,
  visitor_reset_ms: null,
  ...over,
});
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
});
it("admits the visitor and records an anonymous system audit event in one transaction", async () => {
  m.execute
    .mockResolvedValueOnce([]) // budget lock
    .mockResolvedValueOnce([]) // prune
    .mockResolvedValueOnce([usage({ global: 10, visitor: 2 })])
    .mockResolvedValueOnce([]) // admission insert
    .mockResolvedValueOnce([{ id: "event" }]);
  await expect(reserveQuestionPlanning(artist, visitor)).resolves.toBeUndefined();
  const [lock, , , admission, audit] = m.execute.mock.calls.map(c => renderSql(c[0]));
  expect(lock.text).toContain(
    "pg_advisory_xact_lock(hashtext('musicnerd-question-planning-budget'))",
  );
  expect(admission.text).toContain(
    "insert into question_planning_admissions(visitor_key,admitted_at)",
  );
  expect(admission.params).toEqual([visitor, "2026-10-21 12:00:00+00"]);
  expect(audit.text).toContain("'system','question_plan','ask_about_budget'");
  expect(audit.params[0]).toBe(artist);
});
it("denies the visitor's 31st hourly question with its exact reset, after pruning", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([usage({ visitor: 30, visitor_reset_ms: nowMs + 3_000_000 })]);
  await expect(reserveQuestionPlanning(artist, visitor)).rejects.toMatchObject({
    status: 429,
    code: "visitor_question_quota",
    retryAfterSeconds: 3000,
    resetAt: new Date(nowMs + 3_000_000).toISOString(),
  });
  expect(m.execute).toHaveBeenCalledTimes(3);
});
it("reports the later gate when both the visitor and the global day are exhausted", async () => {
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      usage({
        visitor: 30,
        visitor_reset_ms: nowMs + 60_000,
        global: 200,
        global_reset_ms: nowMs + 600_000,
      }),
    ]);
  await expect(reserveQuestionPlanning(artist, visitor)).rejects.toMatchObject({
    code: "question_planning_quota",
    retryAfterSeconds: 600,
  });
});
it("fails closed on an unhashed visitor key, a missing reset or a failed audit insert", async () => {
  await expect(reserveQuestionPlanning(artist, "192.0.2.1")).rejects.toThrow();
  expect(m.transaction).not.toHaveBeenCalled();
  m.execute
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([usage({ global: 200 })]);
  await expect(reserveQuestionPlanning(artist, visitor)).rejects.toThrow("reset unavailable");
  m.execute
    .mockReset()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([usage()])
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([]);
  await expect(reserveQuestionPlanning(artist, visitor)).rejects.toThrow("reservation unavailable");
});
