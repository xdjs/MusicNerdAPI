import { describe, it, expect, vi, beforeEach } from "vitest";

const sdkGenerateText = vi.fn();
vi.mock("ai", () => ({ generateText: (...a: unknown[]) => sdkGenerateText(...a) }));
const { generateText } = await import("@/lib/ai/generateText");

beforeEach(() => sdkGenerateText.mockReset().mockResolvedValue({ text: "ok" }));

describe("generateText", () => {
  it("defaults to Flash through the gateway and passes the call through", async () => {
    await generateText({ prompt: "p", instructions: "i", temperature: 0.2 });
    expect(sdkGenerateText).toHaveBeenCalledWith({
      model: "google/gemini-2.5-flash",
      instructions: "i",
      prompt: "p",
      temperature: 0.2,
      output: undefined,
    });
  });

  it("sends a thinking budget as Google provider options, only when given", async () => {
    await generateText({ prompt: "p", thinkingBudget: 0, model: "google/other" });
    expect(sdkGenerateText.mock.calls[0][0]).toMatchObject({
      model: "google/other",
      providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
    });
  });
});

it("passes explicit research cancellation, output and retry limits through without changing other calls", async () => {
  const abortSignal = AbortSignal.timeout(1000);
  await generateText({ prompt: "bounded", abortSignal, maxOutputTokens: 100, maxRetries: 0 });
  expect(sdkGenerateText.mock.calls[0][0]).toMatchObject({
    abortSignal,
    maxOutputTokens: 100,
    maxRetries: 0,
  });
});

it("sends a Gemini thinking level and an Anthropic effort as provider options, only when given", async () => {
  await generateText({ prompt: "p", model: "google/gemini-3.8-flash", thinkingLevel: "low" });
  expect(sdkGenerateText.mock.calls[0][0]).toMatchObject({
    providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
  });
  await generateText({ prompt: "p", model: "anthropic/claude-sonnet-5.5", anthropicEffort: "low" });
  expect(sdkGenerateText.mock.calls[1][0]).toMatchObject({
    providerOptions: { anthropic: { effort: "low" } },
  });
  expect(sdkGenerateText.mock.calls[1][0].providerOptions).not.toHaveProperty("google");
});
