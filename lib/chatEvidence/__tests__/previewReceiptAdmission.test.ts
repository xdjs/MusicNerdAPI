import { expect, it, vi } from "vitest";
import { simulateReadableStream } from "ai";
import { createPreviewEvidenceBudget } from "../createPreviewEvidenceBudget";
const receipt = (id: string) => ({
  id,
  model: "anthropic/claude-sonnet-5.5",
  provider_name: "anthropic",
  streamed: true,
  finish_reason: "tool-calls",
  native_tokens_prompt: 10,
  native_tokens_completion: 2,
  native_tokens_reasoning: 0,
  native_tokens_cached: 0,
  native_tokens_cache_creation: 0,
  billable_web_search_calls: 0,
  total_cost: 0.00001,
  surcharge_cost: 0,
  gateway_cost: 0.00001,
});
async function setup(lookup: (id: string, signal: AbortSignal) => Promise<unknown>) {
  const events: Record<string, unknown>[] = [];
  const guard = createPreviewEvidenceBudget(x => events.push(x), lookup);
  let calls = 0;
  const invoke = async (bytes: number, signal?: AbortSignal) => {
    const params = { maxOutputTokens: 1024, prompt: "", abortSignal: signal };
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
                providerMetadata: { gateway: { generationId: `gen_${calls}` } },
                usage: { inputTokens: { total: 10 }, outputTokens: { total: 2 } },
              },
            ],
          }),
        };
      },
    } as never);
    const reader = result.stream.getReader();
    while (!(await reader.read()).done) {}
  };
  await invoke(3000);
  await invoke(8000);
  return { guard, events, invoke, calls: () => calls };
}
it("never looks up while reservations fit; settles each exact completed generation once", async () => {
  const lookup = vi.fn(async id => {
    if (id === "gen_2") throw new Error("Not ready and not needed");
    return receipt(id);
  });
  const s = await setup(lookup);
  expect(lookup).not.toHaveBeenCalled();
  await s.invoke(13000);
  expect(lookup.mock.calls.map(c => c[0])).toEqual(["gen_1"]);
  expect(s.events.filter(x => x.phase === "settled").map(x => x.step)).toEqual([1]);
  expect(s.calls()).toBe(3);
});
it("permits one bounded receipt-readiness retry, not a model retry", async () => {
  let tries = 0;
  const lookup = vi.fn(async id => {
    if (++tries === 1) throw new Error("Not indexed");
    return receipt(id);
  });
  const s = await setup(lookup);
  await s.invoke(13000);
  expect(lookup.mock.calls.map(c => c[0])).toEqual(["gen_1", "gen_1"]);
  expect(s.calls()).toBe(3);
});
it.each(["mismatch", "unavailable", "extra_charge"])(
  "blocks next inference on %s",
  async scenario => {
    const lookup = vi.fn(async id => {
      if (scenario === "unavailable") throw new Error("Not indexed");
      if (scenario === "mismatch") return receipt("other");
      return { ...receipt(id), surcharge_cost: 1, gateway_cost: 1.00001 };
    });
    const s = await setup(lookup);
    await expect(s.invoke(13000)).rejects.toThrow();
    expect(s.calls()).toBe(2);
    expect(s.guard.failed()).toBe(true);
    expect(s.events.some(x => x.phase === "settled")).toBe(false);
    expect(lookup.mock.calls.length).toBe(scenario === "unavailable" ? 2 : 1);
  },
);
it("aborts receipt waiting without another generation or reservation release", async () => {
  const controller = new AbortController();
  const lookup = vi.fn(async (_id, signal: AbortSignal) => {
    controller.abort();
    signal.throwIfAborted();
    throw new Error("unreachable");
  });
  const s = await setup(lookup);
  await expect(s.invoke(13000, controller.signal)).rejects.toThrow();
  expect(s.events.at(-1)).toMatchObject({ phase: "stopped", reason: "accounting_aborted" });
  expect(s.calls()).toBe(2);
});
it("bounds an unresponsive lookup and never settles its late completion", async () => {
  let release!: (value: unknown) => void;
  const lookup = vi.fn(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
  const s = await setup(lookup);
  const started = performance.now();
  await expect(s.invoke(13000)).rejects.toThrow();
  expect(performance.now() - started).toBeLessThan(2500);
  release(receipt("gen_1"));
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(s.events.some(x => x.phase === "settled")).toBe(false);
  expect(s.calls()).toBe(2);
});
it("reports current safe lookup category without stale HTTP status or raw details", async () => {
  let attempt = 0;
  const s = await setup(async () => {
    attempt++;
    throw Object.assign(
      new Error("private response body and credential"),
      attempt === 1
        ? { receiptCode: "receipt_http", httpStatus: 503 }
        : { receiptCode: "receipt_json" },
    );
  });
  await expect(s.invoke(13000)).rejects.toThrow();
  expect(s.events.at(-1)).toMatchObject({
    reason: "accounting_unavailable",
    lookupFailure: "receipt_json",
  });
  expect(s.events.at(-1)).not.toHaveProperty("lookupHttpStatus");
  expect(JSON.stringify(s.events)).not.toContain("private response");
});
it("distinguishes exact receipt identity mismatch from a lookup transport failure", async () => {
  const s = await setup(async () => receipt("wrong_id"));
  await expect(s.invoke(13000)).rejects.toThrow();
  expect(s.events.at(-1)).toMatchObject({ lookupFailure: "receipt_identity" });
});
