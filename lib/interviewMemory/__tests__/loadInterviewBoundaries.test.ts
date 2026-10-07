import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { loadInterviewBoundaries } from "@/lib/interviewMemory/loadInterviewBoundaries";
import { toInterviewBoundary } from "@/lib/interviewMemory/toInterviewBoundary";
const m = vi.hoisted(() => ({ transaction: vi.fn(), execute: vi.fn(), authorize: vi.fn() }));
vi.mock("@/lib/db/db", () => ({ db: { transaction: m.transaction } }));
vi.mock("@/lib/knowledge/authorizeArtistKnowledge", () => ({
  authorizeArtistKnowledge: m.authorize,
}));
const artist = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "22222222-2222-4222-8222-222222222222",
  artist_id: artist,
  request_id: artist,
  wording: "  Keep my exact words.  ",
  scope: "until_retracted" as const,
  sitting: 1,
  origin_answer_id: null,
  origin_question_key: "q",
  origin_question: "Question?",
  created_at: "2026-10-01T00:00:00Z",
  retracted_at: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  m.transaction.mockImplementation(fn => fn({ execute: m.execute }));
  m.execute.mockResolvedValueOnce([{ n: 2 }]).mockResolvedValueOnce([row]);
});
it("reauthorizes and reads only active boundary content in a read-only snapshot", async () => {
  expect(await loadInterviewBoundaries(artist, "account", { sitting: 2 })).toEqual({
    status: "ok",
    sitting: 2,
    boundaries: [toInterviewBoundary(row)],
    nextCursor: null,
  });
  expect(m.authorize).toHaveBeenCalledWith(expect.anything(), artist, "account");
  expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
  const queries = m.execute.mock.calls.map(([q]) => new PgDialect().sqlToQuery(q));
  expect(queries[1].sql).toContain("retracted_at is null");
  expect(queries[1].sql).toContain("scope='until_retracted' or sitting=");
  expect(queries[1].params).toEqual([artist, 2]);
  expect(queries.map(q => q.sql).join(" ")).not.toMatch(
    /artist_doc_corrections|char_length|insert |update |delete /i,
  );
});
it("does not read private content when authorization fails", async () => {
  m.authorize.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }));
  await expect(loadInterviewBoundaries(artist, "other", { sitting: 2 })).rejects.toMatchObject({
    status: 403,
  });
  expect(m.execute).not.toHaveBeenCalled();
});
it.each([1, 4])("rejects stale or skipped sitting %i", async sitting => {
  await expect(loadInterviewBoundaries(artist, "account", { sitting })).rejects.toMatchObject({
    status: 409,
  });
  expect(m.execute).toHaveBeenCalledTimes(1);
});
it("allows the next sitting before it has a question", async () => {
  expect((await loadInterviewBoundaries(artist, "account", { sitting: 3 })).sitting).toBe(3);
});
