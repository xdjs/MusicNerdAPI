import { describe, expect, it } from "vitest";
import { toInterviewResponse } from "../toInterviewResponse";
import { normalizeArtistKnowledge } from "@/lib/knowledge/normalizeArtistKnowledge";
import { answer, rawKnowledge } from "@/lib/knowledge/__tests__/fixtures";

describe("toInterviewResponse", () => {
  it("preserves exact words and uses the shared history revision", () => {
    const row = { ...answer, answer: "  The demo only.\nNot the album.  " };
    const current = toInterviewResponse(row);
    const history = normalizeArtistKnowledge({ ...rawKnowledge, answers: [row] }).history[0];
    expect(current.answer).toBe(row.answer);
    expect(current.question).toBe(row.question);
    expect(current.revision).toBe(history.revision);
    expect(current.offeredAt).toBe("2026-10-01T00:00:00.000Z");
    expect(toInterviewResponse({ ...row, createdAt: "2026-10-03T00:00:00Z" }).revision).not.toBe(
      current.revision,
    );
    expect(toInterviewResponse({ ...row, answer: "Different answer" }).revision).not.toBe(
      current.revision,
    );
  });
  it("rejects absent and invalid stored answers rather than presenting them as testimony", () => {
    expect(() => toInterviewResponse({ ...answer, answer: null })).toThrow();
    expect(() => toInterviewResponse({ ...answer, answer: " " })).toThrow();
    expect(() => toInterviewResponse({ ...answer, answer: "a".repeat(50001) })).toThrow();
  });
});
