import { describe, expect, it } from "vitest";
import { validateRecentEditedQuery } from "@/lib/contributions/validateRecentEditedQuery";

describe("validateRecentEditedQuery", () => {
  it("returns the userId, or null when absent or empty", () => {
    expect(
      validateRecentEditedQuery(
        new Request(
          "https://example.org/api/recentEdited?userId=00000000-0000-4000-8000-000000000010",
        ),
      ),
    ).toEqual({ userId: "00000000-0000-4000-8000-000000000010" });
    expect(validateRecentEditedQuery(new Request("https://example.org/api/recentEdited"))).toEqual({
      userId: null,
    });
    expect(
      validateRecentEditedQuery(new Request("https://example.org/api/recentEdited?userId=")),
    ).toEqual({ userId: null });
  });
});
