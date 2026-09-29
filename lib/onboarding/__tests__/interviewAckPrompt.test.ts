import { describe, it, expect } from "vitest";
import { interviewAckPrompt } from "@/lib/onboarding/interviewAckPrompt";

describe("interviewAckPrompt", () => {
  it("quotes the question and answer and forbids memory and apology", () => {
    const p = interviewAckPrompt("Who mixed it?", "My cousin");
    expect(p.startsWith('The artist was asked: "Who mixed it?" and answered: "My cousin".')).toBe(
      true,
    );
    expect(p).toContain("Reply with ONE short, spoken sentence reacting to their answer.");
    expect(p).toContain('no "I remember", "I thought", "I must have misremembered"');
    expect(p).toContain("- No questions, no emoji, no hype words.");
  });
});
