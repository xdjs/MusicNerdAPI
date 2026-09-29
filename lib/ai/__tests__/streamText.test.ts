import { describe, it, expect, vi, beforeEach } from "vitest";

const { sdkStreamText } = vi.hoisted(() => ({ sdkStreamText: vi.fn() }));
vi.mock("ai", () => ({ streamText: sdkStreamText }));
const { streamText } = await import("@/lib/ai/streamText");

/** What the SDK's streamText returns, reduced to the part the wrapper reads. */
function streamOf(parts: object[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) yield part;
    })(),
  };
}

beforeEach(() => sdkStreamText.mockReset());

describe("streamText", () => {
  it("calls onTextDelta with each piece of text in order and resolves the whole text", async () => {
    sdkStreamText.mockReturnValue(
      streamOf([
        { type: "start" },
        { type: "text-delta", id: "t", text: "Dutchyyy is " },
        { type: "text-delta", id: "t", text: "a producer." },
        { type: "finish" },
      ]),
    );
    const deltas: string[] = [];
    const result = await streamText({ prompt: "hi", onTextDelta: d => deltas.push(d) });
    expect(deltas).toEqual(["Dutchyyy is ", "a producer."]);
    expect(result).toEqual({ text: "Dutchyyy is a producer." });
  });

  it("works without onTextDelta", async () => {
    sdkStreamText.mockReturnValue(streamOf([{ type: "text-delta", id: "t", text: "ok" }]));
    await expect(streamText({ prompt: "hi" })).resolves.toEqual({ text: "ok" });
  });

  it("rejects with the stream's error, as generateText would have thrown", async () => {
    const boom = new Error("gateway 500");
    sdkStreamText.mockReturnValue(
      streamOf([
        { type: "text-delta", id: "t", text: "partial" },
        { type: "error", error: boom },
      ]),
    );
    await expect(streamText({ prompt: "hi" })).rejects.toBe(boom);
  });

  it("defaults to Flash and passes instructions, prompt, temperature and the thinking budget", async () => {
    sdkStreamText.mockReturnValue(streamOf([]));
    await streamText({
      instructions: "be brief",
      prompt: "hi",
      temperature: 0.4,
      thinkingBudget: 0,
    });
    const call = sdkStreamText.mock.calls[0][0];
    expect(call.model).toBe("google/gemini-2.5-flash");
    expect(call.instructions).toBe("be brief");
    expect(call.prompt).toBe("hi");
    expect(call.temperature).toBe(0.4);
    expect(call.providerOptions).toEqual({ google: { thinkingConfig: { thinkingBudget: 0 } } });
  });

  it("sends no provider options without a thinking budget, and uses the model it is given", async () => {
    sdkStreamText.mockReturnValue(streamOf([]));
    await streamText({ model: "google/gemini-2.5-flash-lite", prompt: "hi" });
    const call = sdkStreamText.mock.calls[0][0];
    expect(call.model).toBe("google/gemini-2.5-flash-lite");
    expect(call.providerOptions).toBeUndefined();
  });
});
