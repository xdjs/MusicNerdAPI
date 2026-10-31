import { expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { isStepCount, simulateReadableStream, streamText, tool, wrapLanguageModel } from "ai";
import { z } from "zod";
import { createPreviewEvidenceBudget } from "../createPreviewEvidenceBudget";

const finish = {
  type: "finish" as const,
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 2, text: 2, reasoning: undefined },
  },
};
it("reserves the prepared input and output before calling and records actual usage", async () => {
  const receipts: unknown[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  const model = new MockLanguageModelV4({
    doStream: { stream: simulateReadableStream({ chunks: [finish] }) },
  });
  const result = streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Hello",
    maxOutputTokens: 1024,
    maxRetries: 0,
  });
  await result.consumeStream();
  guard.finish();
  expect(model.doStreamCalls).toHaveLength(1);
  expect(receipts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ phase: "reserved", outputTokens: 1024 }),
      expect.objectContaining({ phase: "reconciled", inputTokens: 10, outputTokens: 2 }),
      expect.objectContaining({ phase: "complete" }),
    ]),
  );
});
it("refuses oversized complete input before any provider call rather than truncating", async () => {
  const receipts: unknown[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  const model = new MockLanguageModelV4();
  const result = streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "x".repeat(100000),
    maxOutputTokens: 1024,
    maxRetries: 0,
  });
  await result.consumeStream();
  expect(model.doStreamCalls).toHaveLength(0);
  expect(guard.failed()).toBe(true);
  expect(receipts).toContainEqual(
    expect.objectContaining({ phase: "stopped", reason: "reservation_limit" }),
  );
});
it("fails closed before inference when reservation capture fails", async () => {
  const guard = createPreviewEvidenceBudget(() => {
    throw new Error("capture failed");
  });
  const model = new MockLanguageModelV4();
  const result = streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Hello",
    maxOutputTokens: 1024,
    maxRetries: 0,
  });
  await result.consumeStream();
  expect(model.doStreamCalls).toHaveLength(0);
  expect(guard.failed()).toBe(true);
});
it("retains reservations and fails closed when usage is absent", async () => {
  const receipts: unknown[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  const model = new MockLanguageModelV4({
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          {
            ...finish,
            usage: {
              inputTokens: {
                total: undefined,
                noCache: undefined,
                cacheRead: undefined,
                cacheWrite: undefined,
              },
              outputTokens: { total: undefined, text: undefined, reasoning: undefined },
            },
          },
        ],
      }),
    },
  });
  const result = streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Hello",
    maxOutputTokens: 1024,
    maxRetries: 0,
  });
  await result.consumeStream();
  expect(guard.failed()).toBe(true);
  expect(receipts).toContainEqual(
    expect.objectContaining({ phase: "stopped", reason: "usage_missing" }),
  );
});
it("counts schemas and growing tool history on every step without refunding low actual usage", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  let n = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "tool-call", toolCallId: `t${++n}`, toolName: "read", input: "{}" },
          { ...finish, finishReason: { unified: "tool-calls", raw: undefined } },
        ],
      }),
    }),
  });
  const result = streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Read evidence",
    tools: {
      read: tool({
        description: "Complete evidence",
        inputSchema: z.object({}),
        execute: async () => "界".repeat(1500),
      }),
    },
    maxOutputTokens: 1024,
    maxRetries: 0,
    stopWhen: isStepCount(6),
  });
  await result.consumeStream();
  expect(n).toBeGreaterThan(1);
  expect(n).toBeLessThan(6);
  const reservations = receipts.filter(x => x.phase === "reserved");
  expect(Number(reservations[1].preparedBytes)).toBeGreaterThan(
    Number(reservations[0].preparedBytes) + 4500,
  );
  expect(Number(reservations.at(-1)!.reservedUsd)).toBeLessThanOrEqual(0.15);
  expect(receipts.at(-1)).toMatchObject({ phase: "stopped", reason: "reservation_limit" });
});
it.each(["length", "error"] as const)("stops after an abnormal %s finish", async reason => {
  const guard = createPreviewEvidenceBudget(() => {});
  const model = new MockLanguageModelV4({
    doStream: {
      stream: simulateReadableStream({
        chunks: [{ ...finish, finishReason: { unified: reason, raw: undefined } }],
      }),
    },
  });
  await streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Hi",
    maxOutputTokens: 1024,
    maxRetries: 0,
  }).consumeStream();
  expect(guard.failed()).toBe(true);
  expect(model.doStreamCalls).toHaveLength(1);
});
it("latches reconciliation capture failure so another generation cannot start", async () => {
  const guard = createPreviewEvidenceBudget(x => {
    if (x.phase === "reconciled") throw new Error("capture");
  });
  const model = new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks: [finish] }) }),
  });
  const wrapped = wrapLanguageModel({ model, middleware: guard.middleware });
  await streamText({
    model: wrapped,
    prompt: "Hi",
    maxOutputTokens: 1024,
    maxRetries: 0,
  }).consumeStream();
  await streamText({
    model: wrapped,
    prompt: "Again",
    maxOutputTokens: 1024,
    maxRetries: 0,
  }).consumeStream();
  expect(guard.failed()).toBe(true);
  expect(model.doStreamCalls).toHaveLength(1);
});
