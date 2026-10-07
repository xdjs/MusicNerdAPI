import { describe, expect, it } from "vitest";
import { pageInterviewResponses } from "../pageInterviewResponses";

describe("pageInterviewResponses", () => {
  const rows = [
    { id: "a", revision: "first" },
    { id: "b", revision: "second" },
  ];
  it("pages without dropping an item and rejects cross-artist or stale continuations", () => {
    const first = pageInterviewResponses(rows, ["artist", "responses"], { limit: 1 });
    expect(first.items).toEqual([rows[0]]);
    const last = pageInterviewResponses(rows, ["artist", "responses"], {
      limit: 1,
      cursor: first.nextCursor!,
    });
    expect(last.items).toEqual([rows[1]]);
    expect(last.nextCursor).toBeNull();
    expect(() =>
      pageInterviewResponses(rows, ["other", "responses"], { limit: 1, cursor: first.nextCursor! }),
    ).toThrow();
    expect(() =>
      pageInterviewResponses([rows[0]], ["artist", "responses"], {
        limit: 1,
        cursor: first.nextCursor!,
      }),
    ).toThrow();
  });
});
