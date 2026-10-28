import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertReadableStreamToArray } from "ai/test";

const { sdkStreamText } = vi.hoisted(() => ({ sdkStreamText: vi.fn() }));
const { toUIMessageStream } = vi.hoisted(() => ({ toUIMessageStream: vi.fn() }));
vi.mock("ai", () => ({ streamText: sdkStreamText, toUIMessageStream }));
const { streamText } = await import("@/lib/ai/streamText");

/** What the SDK's streamText returns, reduced to the part the wrapper reads. */
function streamOf(parts: object[]) {
  return {
    fullStream: (async function* () {
      for (const part of parts) yield part;
    })(),
  };
}

beforeEach(() => {
  sdkStreamText.mockReset();
  toUIMessageStream.mockReset();
});

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

  it("passes an Anthropic effort as provider options", async () => {
    sdkStreamText.mockReturnValue(streamOf([]));
    await streamText({
      model: "anthropic/claude-sonnet-5.5",
      prompt: "hi",
      anthropicEffort: "low",
    });
    expect(sdkStreamText.mock.calls[0][0].providerOptions).toEqual({
      anthropic: { effort: "low" },
    });
  });

  it("passes messages, tools, the stop condition and the abort signal through", async () => {
    sdkStreamText.mockReturnValue(streamOf([]));
    const tools = { searchSources: {} } as never;
    const stopWhen = () => true;
    const abortSignal = new AbortController().signal;
    const prompt = [{ role: "user" as const, content: "hi" }];
    await streamText({ prompt, tools, stopWhen, abortSignal });
    const call = sdkStreamText.mock.calls[0][0];
    expect(call.prompt).toBe(prompt);
    expect(call.tools).toBe(tools);
    expect(call.stopWhen).toBe(stopWhen);
    expect(call.abortSignal).toBe(abortSignal);
  });

  it("merges the UI message stream, without provider custom parts, into a writer", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "custom", kind: "anthropic.message_start" });
        controller.enqueue({ type: "text-delta", id: "t", text: "Hi" });
        controller.close();
      },
    });
    sdkStreamText.mockReturnValue({ ...streamOf([]), stream });
    toUIMessageStream.mockReturnValue("ui stream");
    const writer = { merge: vi.fn(), write: vi.fn(), onError: undefined };
    const tools = { readSource: {} } as never;
    await streamText({ prompt: "hi", tools, writer });
    const sent = toUIMessageStream.mock.calls[0][0];
    expect(sent.tools).toBe(tools);
    expect(await convertReadableStreamToArray(sent.stream)).toEqual([
      { type: "text-delta", id: "t", text: "Hi" },
    ]);
    expect(writer.merge).toHaveBeenCalledWith("ui stream");
  });

  it("keeps the model's reasoning out of the UI stream", async () => {
    sdkStreamText.mockReturnValue({ ...streamOf([]), stream: new ReadableStream() });
    toUIMessageStream.mockReturnValue("ui stream");
    const writer = { merge: vi.fn(), write: vi.fn(), onError: undefined };
    await streamText({ prompt: "hi", writer });
    expect(toUIMessageStream.mock.calls[0][0].sendReasoning).toBe(false);
  });

  it("writes no UI stream without a writer", async () => {
    sdkStreamText.mockReturnValue(streamOf([]));
    await streamText({ prompt: "hi" });
    expect(toUIMessageStream).not.toHaveBeenCalled();
  });
});
