import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const generateText = vi.fn();
vi.mock("@/lib/ai/generateText", () => ({
  generateText: (...a: unknown[]) => generateText(...a),
}));
const { generateFunFact } = await import("@/lib/funFacts/generateFunFact");

beforeEach(() => {
  generateText.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("generateFunFact", () => {
  it("asks the default model with the writer instructions and temperature 0.8", async () => {
    generateText.mockResolvedValueOnce({ text: "A fact." });
    expect(await generateFunFact("About Bio Ritmo")).toBe("A fact.");
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(generateText.mock.calls[0][0]).toEqual({
      prompt: "About Bio Ritmo",
      instructions: expect.stringContaining("You are a sharp music writer."),
      temperature: 0.8,
    });
    expect(generateText.mock.calls[0][0]).not.toHaveProperty("model");
  });

  it("returns an empty string when the model returned no text", async () => {
    generateText.mockResolvedValueOnce({});
    expect(await generateFunFact("p")).toBe("");
  });

  it("gives up after 15 seconds", async () => {
    generateText.mockReturnValueOnce(new Promise(() => {}));
    const result = generateFunFact("p");
    const settled = result.then(
      () => "resolved",
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(14_999);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await settled).toBe("Gemini timeout");
  });

  it("clears its timer once the model answers, and passes a model error through", async () => {
    generateText.mockResolvedValueOnce({ text: "ok" });
    await generateFunFact("p");
    expect(vi.getTimerCount()).toBe(0);
    generateText.mockRejectedValueOnce(new Error("gateway"));
    await expect(generateFunFact("p")).rejects.toThrow("gateway");
    expect(vi.getTimerCount()).toBe(0);
  });
});
