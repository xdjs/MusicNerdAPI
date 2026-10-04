import { beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
const generateText = vi.fn();
vi.mock("@/lib/ai/generateText", () => ({ generateText: (...a: unknown[]) => generateText(...a) }));
const { callInterviewModel } = await import("@/lib/interviewExperiment/callInterviewModel");
beforeEach(() =>
  generateText
    .mockReset()
    .mockResolvedValue({ output: { ok: true }, totalUsage: { inputTokens: 40, outputTokens: 12 } }),
);
it("records actual usage and cancels bounded calls with retries disabled", async () => {
  const r = await callInterviewModel(
    "draft",
    "instructions",
    { evidence: "hello" },
    z.object({ ok: z.boolean() }),
    "test/model",
  );
  expect(r.call).toMatchObject({ inputTokens: 40, outputTokens: 12 });
  expect(generateText.mock.calls[0][0]).toMatchObject({
    maxRetries: 0,
    maxOutputTokens: 6144,
    model: "test/model",
  });
  expect(generateText.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal);
});
it("refuses oversized input before a paid call", async () => {
  await expect(
    callInterviewModel(
      "draft",
      "instructions",
      { text: "é".repeat(50000) },
      z.object({}),
      "test/model",
    ),
  ).rejects.toThrow(/budget/);
  expect(generateText).not.toHaveBeenCalled();
});

it("reports stage and validation paths without echoing source text or provider responses", async () => {
  generateText.mockRejectedValueOnce({
    name: "AI_NoObjectGeneratedError",
    text: "private source text",
    finishReason: "stop",
    usage: { inputTokens: 30, outputTokens: 10 },
    cause: {
      cause: {
        issues: [
          {
            code: "too_big",
            path: ["questions", 0, "evidence", 0, "quote"],
            message: "private source text",
          },
        ],
      },
    },
  });
  await expect(
    callInterviewModel("draft", "instructions", {}, z.object({}), "test/model"),
  ).rejects.toThrow("questions.0.evidence.0.quote:too_big");
});
