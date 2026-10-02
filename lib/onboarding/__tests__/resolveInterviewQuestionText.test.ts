import { describe, it, expect } from "vitest";
import { resolveInterviewQuestionText } from "@/lib/onboarding/resolveInterviewQuestionText";

describe("resolveInterviewQuestionText", () => {
  it("looks a static key up server-side and ignores the client's text", () => {
    expect(resolveInterviewQuestionText("offline_fact", "something else")).toBe(
      "What's something fans should know about you that isn't written anywhere online?",
    );
  });

  it("trusts a grounded key's client text, trimmed and capped at 500", () => {
    expect(resolveInterviewQuestionText("social_credit_x", "  Who mixed it?  ")).toBe(
      "Who mixed it?",
    );
    expect(resolveInterviewQuestionText("social_credit_x", "q".repeat(600))).toHaveLength(500);
  });

  it("is null for an empty grounded question or an unknown key", () => {
    expect(resolveInterviewQuestionText("social_credit_x", "   ")).toBeNull();
    expect(resolveInterviewQuestionText("social_credit_x", undefined)).toBeNull();
    expect(resolveInterviewQuestionText("made_up", "q")).toBeNull();
  });
});
