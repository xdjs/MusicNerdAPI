import { expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { isStepCount, simulateReadableStream, streamText, tool, wrapLanguageModel } from "ai";
import { z } from "zod";
import { createPreviewEvidenceBudget } from "../createPreviewEvidenceBudget";

const completeAccounting = {
  gateway: {
    generationId: "gen_test",
    cost: "0.00001",
    gatewayCost: "0.00001",
    routing: {
      modelAttemptCount: 1,
      totalProviderAttemptCount: 1,
      modelAttempts: [
        {
          success: true,
          providerAttemptCount: 1,
          providerAttempts: [{ success: true, provider: "anthropic" }],
        },
      ],
    },
  },
};
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
it("counts schemas and growing tool history on every step while settling completed usage", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  let n = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "tool-call", toolCallId: `t${++n}`, toolName: "readSource", input: "{}" },
          { ...finish, finishReason: { unified: "tool-calls", raw: undefined } },
        ],
      }),
    }),
  });
  const result = streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Read evidence",
    tools: {
      readSource: tool({
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
  expect(n).toBe(6);
  const reservations = receipts.filter(x => x.phase === "reserved");
  expect(Number(reservations[1].preparedBytes)).toBeGreaterThan(
    Number(reservations[0].preparedBytes) + 4500,
  );
  expect(Number(reservations.at(-1)!.reservedUsd)).toBeLessThanOrEqual(0.15);
  guard.finish();
  expect(receipts.at(-1)).toMatchObject({ phase: "complete" });
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

it("admits realistic multi-source history with token estimates alone", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  let calls = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "tool-call", toolCallId: `t${++calls}`, toolName: "readSource", input: "{}" },
          {
            ...finish,
            providerMetadata: {
              gateway: { ...completeAccounting.gateway, generationId: `gen_${calls}` },
            },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 2, text: 2, reasoning: 0 },
            },
            finishReason: { unified: "tool-calls", raw: undefined },
          },
        ],
      }),
    }),
  });
  await streamText({
    model: wrapLanguageModel({ model, middleware: guard.middleware }),
    prompt: "Compare the eight ranked saved sources and select context",
    tools: {
      readSource: tool({
        inputSchema: z.object({}),
        execute: async () =>
          Array.from({ length: 8 }, (_, i) => ({
            title: `Source ${i}`,
            passage: "Evidence. ".repeat(35),
          })),
      }),
    },
    maxOutputTokens: 1024,
    maxRetries: 0,
    stopWhen: isStepCount(4),
  }).consumeStream();
  guard.finish();
  expect(calls).toBe(4);
  expect(receipts.filter(x => x.phase === "reconciled")).toHaveLength(4);
  expect(receipts.at(-1)).toMatchObject({ phase: "complete" });
  expect(Number(receipts.at(-1)!.reservedUsd)).toBeLessThan(0.15);
  expect(
    receipts.filter(x => x.phase === "reconciled").every(x => x.accounting === "estimated_usage"),
  ).toBe(true);
});

const accountedFinish = {
  ...finish,
  providerMetadata: completeAccounting,
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 2, text: 2, reasoning: 0 },
  },
};
it.each(["duplicate", "late_error", "aborted", "abnormal", "capture"])(
  "does not release a reservation on %s",
  async scenario => {
    const receipts: Record<string, unknown>[] = [];
    const controller = new AbortController();
    const guard = createPreviewEvidenceBudget(x => {
      if (scenario === "capture" && x.phase === "reconciled") throw new Error("capture");
      receipts.push(x);
    });
    const chunks: unknown[] =
      scenario === "duplicate"
        ? [accountedFinish, accountedFinish]
        : scenario === "late_error"
          ? [accountedFinish, { type: "error" as const, error: new Error("private") }]
          : scenario === "abnormal"
            ? [{ ...accountedFinish, finishReason: { unified: "length" as const, raw: undefined } }]
            : [accountedFinish];
    const result = await guard.middleware.wrapStream!({
      params: { maxOutputTokens: 1024, prompt: [], abortSignal: controller.signal },
      doStream: async () => ({ stream: simulateReadableStream({ chunks }) }),
    } as never);
    if (scenario === "aborted") controller.abort();
    const reader = result.stream.getReader();
    await expect(
      (async () => {
        while (!(await reader.read()).done) {}
      })(),
    ).rejects.toThrow();
    expect(guard.failed()).toBe(true);
    expect(receipts.filter(x => x.phase === "reconciled")).toHaveLength(0);
    expect(receipts.at(-1)!.reservedUsd).toBe(receipts[0].reservedUsd);
  },
);
it("retains a cancelled stream and blocks concurrent admission", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  let calls = 0;
  const invoke = () =>
    guard.middleware.wrapStream!({
      params: { maxOutputTokens: 1024, prompt: [] },
      doStream: async () => {
        calls++;
        return { stream: new ReadableStream() };
      },
    } as never);
  const first = await invoke();
  await expect(invoke()).rejects.toThrow();
  await first.stream.cancel();
  guard.finish();
  expect(calls).toBe(1);
  expect(guard.failed()).toBe(true);
  expect(receipts.at(-1)!.reservedUsd).toBe(receipts[0].reservedUsd);
});
it("records selection attempted versus rejected without arguments or source content", () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  guard.recordTool("selectPassage", "called");
  guard.recordTool("selectPassage", "returned", { status: "unavailable", secret: "PRIVATE" });
  guard.recordTool("readSource", "returned", { passageId: "PRIVATE", context: "PRIVATE" });
  expect(JSON.stringify(receipts)).not.toContain("PRIVATE");
  expect(receipts.map(x => [x.tool, x.stage, x.outcome])).toEqual([
    ["selectPassage", "called", "unclassified"],
    ["selectPassage", "returned", "unavailable"],
    ["readSource", "returned", "passage_available"],
  ]);
});

it("retains a repeated generation reservation and never emits successful completion", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => receipts.push(x));
  const model = new MockLanguageModelV4({
    doStream: async () => ({ stream: simulateReadableStream({ chunks: [accountedFinish] }) }),
  });
  for (let i = 0; i < 2; i++)
    await streamText({
      model: wrapLanguageModel({ model, middleware: guard.middleware }),
      prompt: "x",
      maxOutputTokens: 1024,
      maxRetries: 0,
    }).consumeStream();
  guard.finish();
  guard.finish();
  expect(receipts.filter(x => x.phase === "reconciled").map(x => x.accounting)).toEqual([
    "estimated_usage",
  ]);
  expect(receipts.filter(x => x.phase === "complete")).toHaveLength(0);
  expect(receipts.at(-1)).toMatchObject({ reason: "duplicate_generation" });
});
