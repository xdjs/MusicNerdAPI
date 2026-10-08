import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const { scoped, values, onConflictDoUpdate } = vi.hoisted(() => ({
  scoped: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
}));
vi.mock("@/lib/ownership/withScopedArtistWrite", () => ({ withScopedArtistWrite: scoped }));
const { upsertInterviewAnswer } = await import("@/lib/onboarding/upsertInterviewAnswer");

const input = {
  artistId: "a1",
  questionKey: "offline_fact",
  question: "q",
  answer: "a",
  sitting: 1,
  source: "onboarding" as const,
};

beforeEach(() => {
  onConflictDoUpdate
    .mockReset()
    .mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "saved" }]) });
  values.mockReset().mockReturnValue({ onConflictDoUpdate });
  scoped.mockReset().mockImplementation(async (_a, write) => write({ insert: () => ({ values }) }));
});

describe("upsertInterviewAnswer", () => {
  it("upserts on (artist, question key) under the scoped write", async () => {
    await upsertInterviewAnswer(input);
    expect(scoped.mock.calls[0][0]).toBe("a1");
    expect(values).toHaveBeenCalledWith(input);
    expect(onConflictDoUpdate.mock.calls[0][0].target).toHaveLength(2);
  });

  it("updates the answer and its time, never the sitting or the offer watermark", async () => {
    await upsertInterviewAnswer({ ...input, source: "followup" });
    const { set, setWhere } = onConflictDoUpdate.mock.calls[0][0];
    expect(new PgDialect().sqlToQuery(setWhere as SQL).params).toEqual(["offered"]);
    expect(set).toMatchObject({ question: "q", answer: "a", source: "followup" });
    expect(new PgDialect().sqlToQuery(set.createdAt as SQL).sql).toContain(
      "now() AT TIME ZONE 'utc'::text",
    );
    expect(set).not.toHaveProperty("offeredAt");
    expect(set).not.toHaveProperty("sitting");
  });
});
