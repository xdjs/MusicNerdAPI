import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderSql } from "@/lib/db/__tests__/renderSql";
import type { SQL } from "drizzle-orm";

const findMany = vi.fn();
vi.mock("@/lib/db/db", () => ({
  db: { query: { artistInterviewAnswers: { findMany: (...a: unknown[]) => findMany(...a) } } },
}));
const { getInterviewAnswers } = await import("@/lib/lore/getInterviewAnswers");

beforeEach(() => findMany.mockReset());

describe("getInterviewAnswers", () => {
  it("reads the artist's answers, oldest first", async () => {
    findMany.mockResolvedValueOnce([{ question: "Q", answer: "A" }]);
    expect(await getInterviewAnswers("a1")).toEqual([{ question: "Q", answer: "A" }]);
    const { where, orderBy } = findMany.mock.calls[0][0];
    expect(renderSql(where as SQL).params).toEqual(["a1"]);
    expect(renderSql(orderBy[0] as SQL).text).toContain('"created_at" asc');
  });

  it("returns null on a database error", async () => {
    findMany.mockImplementationOnce(async () => {
      throw new Error("pool");
    });
    expect(await getInterviewAnswers("a1")).toBeNull();
  });
});
