import { expect, it } from "vitest";
import { simulateReadableStream } from "ai";
import { createPreviewEvidenceBudget } from "../createPreviewEvidenceBudget";

it("admits selection after the captured two-step usage without synchronous receipt lookup", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(r => receipts.push(r));
  let calls = 0;
  // First two sizes/usage are captured. Third size/usage are a conservative
  // scripted continuation, not evidence that the live model would select.
  for (const [bytes, input, output] of [
    [2616, 1156, 63],
    [7881, 3350, 119],
    [14000, 4500, 100],
  ]) {
    const params = { maxOutputTokens: 1024, prompt: "" };
    params.prompt = "x".repeat(bytes - Buffer.byteLength(JSON.stringify(params)));
    const result = await guard.middleware.wrapStream!({
      params,
      doStream: async () => {
        calls++;
        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: "finish",
                finishReason: { unified: "tool-calls", raw: undefined },
                usage: { inputTokens: { total: input }, outputTokens: { total: output } },
              },
            ],
          }),
        };
      },
    } as never);
    const reader = result.stream.getReader();
    while (!(await reader.read()).done) {}
  }
  guard.finish();
  expect(calls).toBe(3);
  expect(receipts.filter(r => r.phase === "reserved").map(r => r.reservedUsd)).toEqual([
    0.0317856, 0.060731, 0.1037036,
  ]);
  expect(receipts.at(-1)).toMatchObject({
    phase: "complete",
    reservedUsd: 0.0427284,
    observedUpperEstimateUsd: 0.0427284,
  });
});

it.each([
  ["reasoning exceeds total", { total: 100, text: 80, reasoning: 30 }, "usage_inconsistent"],
  ["negative detail", { total: 100, text: 101, reasoning: -1 }, "usage_inconsistent"],
  ["missing total", { total: undefined, text: 80, reasoning: 20 }, "usage_missing"],
])("retains the reservation for %s", async (_label, output, reason) => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(r => receipts.push(r));
  const result = await guard.middleware.wrapStream!({
    params: { prompt: [], maxOutputTokens: 1024 },
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          {
            type: "finish",
            finishReason: { unified: "stop" },
            usage: { inputTokens: { total: 10 }, outputTokens: output },
          },
        ],
      }),
    }),
  } as never);
  const reader = result.stream.getReader();
  await expect(
    (async () => {
      while (!(await reader.read()).done) {}
    })(),
  ).rejects.toThrow();
  expect(receipts.at(-1)).toMatchObject({ reason, reservedUsd: receipts[0].reservedUsd });
  expect(receipts.some(r => r.phase === "reconciled")).toBe(false);
});
it("settles cache and reasoning within totals once, without requiring optional billing metadata", async () => {
  const receipts: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(r => receipts.push(r));
  const result = await guard.middleware.wrapStream!({
    params: { prompt: [], maxOutputTokens: 1024 },
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          {
            type: "finish",
            finishReason: { unified: "stop" },
            usage: {
              inputTokens: { total: 100, noCache: 20, cacheRead: 30, cacheWrite: 50 },
              outputTokens: { total: 100, text: 80, reasoning: 20 },
            },
          },
        ],
      }),
    }),
  } as never);
  const reader = result.stream.getReader();
  while (!(await reader.read()).done) {}
  guard.finish();
  guard.finish();
  expect(receipts.at(-1)).toMatchObject({
    phase: "complete",
    reservedUsd: 0.00154,
    observedUpperEstimateUsd: 0.00154,
  });
  expect(receipts.filter(r => r.phase === "complete")).toHaveLength(1);
});
it.each([
  { type: "provider", id: "web-search", name: "searchSources", args: {} },
  { type: "function", name: "webSearch", inputSchema: { type: "object" } },
])("rejects billable or unknown tools before inference", async tool => {
  const events: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(r => events.push(r));
  let called = false;
  await expect(
    guard.middleware.wrapStream!({
      params: { prompt: [], maxOutputTokens: 1024, tools: [tool] },
      doStream: async () => {
        called = true;
        throw new Error("must not run");
      },
    } as never),
  ).rejects.toThrow();
  expect(called).toBe(false);
  expect(events.at(-1)).toMatchObject({ reason: "unsupported_tools" });
});
