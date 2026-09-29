import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }));
vi.mock("@/lib/ai/generateText", () => ({ generateText }));
const { generateInterviewAck } = await import("@/lib/onboarding/generateInterviewAck");

beforeEach(() => {
  generateText.mockReset().mockResolvedValue({ text: "  Love the cousin credit.  " });
});

describe("generateInterviewAck", () => {
  it("returns the model's one line, with thinking off", async () => {
    expect(await generateInterviewAck("Who mixed it?", "My cousin", 0)).toBe(
      "Love the cousin credit.",
    );
    expect(generateText).toHaveBeenCalledWith({
      prompt: expect.stringContaining('The artist was asked: "Who mixed it?"'),
      temperature: 0.7,
      thinkingBudget: 0,
    });
  });

  it("falls back, rotating by question, on an empty, blocked or failed reply", async () => {
    generateText.mockResolvedValueOnce({ text: "" });
    expect(await generateInterviewAck("q", "a", 0)).toBe("Love that — noted, in your words.");
    generateText.mockResolvedValueOnce({ text: "Sorry, I misremembered." });
    expect(await generateInterviewAck("q", "a", 1)).toBe(
      "Got it — that's in, just how you put it.",
    );
    generateText.mockRejectedValueOnce(new Error("gateway"));
    expect(await generateInterviewAck("q", "a", 5)).toBe(
      "Got it — that's in, just how you put it.",
    );
  });

  it("falls back when the model takes longer than five seconds", async () => {
    vi.useFakeTimers();
    try {
      generateText.mockReturnValueOnce(new Promise(() => {}));
      const pending = generateInterviewAck("q", "a", 2);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(await pending).toBe("Appreciate you sharing that — saved, word for word.");
    } finally {
      vi.useRealTimers();
    }
  });
});
