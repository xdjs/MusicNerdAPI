import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream, isStepCount, tool, APICallError } from "ai";
import { z } from "zod";
import { createGuardedChatExecution } from "@/lib/evals/createGuardedChatExecution";
import { MODEL_CHAT } from "@/lib/ai/const";

let dir: string;
const events: { kind: string; value: unknown }[] = [];
const external = vi.fn(() => {
  throw new Error("provider_network_forbidden");
});
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "mn1424-guard-"));
  events.length = 0;
  external.mockClear();
  vi.stubGlobal("fetch", external);
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
};
type ModelPart =
  Awaited<ReturnType<MockLanguageModelV4["doStream"]>>["stream"] extends ReadableStream<infer P>
    ? P
    : never;
const result = (call = false) => ({
  stream: simulateReadableStream<ModelPart>({
    chunks: call
      ? [
          {
            type: "tool-call" as const,
            toolCallId: "t",
            toolName: "searchSources",
            input: '{"query":"actual query"}',
          },
          {
            type: "finish" as const,
            finishReason: { unified: "tool-calls" as const, raw: undefined },
            usage,
          },
        ]
      : [
          { type: "text-start" as const, id: "x" },
          { type: "text-delta" as const, id: "x", delta: "Answer." },
          { type: "text-end" as const, id: "x" },
          {
            type: "finish" as const,
            finishReason: { unified: "stop" as const, raw: undefined },
            usage,
          },
        ],
  }),
});
function setup(
  model: MockLanguageModelV4,
  overrides = {},
  record = (kind: string, value: unknown) => {
    events.push({ kind, value });
  },
) {
  const manifest = {
    version: 1,
    runId: "offline",
    modelId: MODEL_CHAT,
    promptSha256: createHash("sha256").update(JSON.stringify("q")).digest("hex"),
    instructionsSha256: createHash("sha256").update(JSON.stringify(null)).digest("hex"),
    toolLimits: { searchSources: 6, readSource: 6 },
    maxToolExecutions: 12,
    maxCalls: 3,
    maxInputBytes: 128000,
    maxOutputTokens: 128,
    maxOutputCharacters: 8192,
    maxCaptureBytes: 1000000,
    ...overrides,
  };
  const path = join(dir, "manifest.json");
  const raw = JSON.stringify(manifest);
  writeFileSync(path, raw, { mode: 0o600 });
  const config = {
    manifestPath: path,
    manifestSha256: createHash("sha256").update(raw).digest("hex"),
    model,
    record,
  };
  return { execute: createGuardedChatExecution(config), config, path };
}
it("forwards exact prepared inputs once, keeps beforeStep, and emits bounded finish usage", async () => {
  const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: async () => result() });
  const beforeStep = vi.fn();
  const { execute, path } = setup(model, {
    promptSha256: createHash("sha256").update(JSON.stringify("same question")).digest("hex"),
    instructionsSha256: createHash("sha256").update(JSON.stringify("same system")).digest("hex"),
  });
  expect(
    await execute({
      model: MODEL_CHAT,
      instructions: "same system",
      prompt: "same question",
      anthropicEffort: "low",
      beforeStep,
    }),
  ).toEqual({ text: "Answer." });
  expect(beforeStep).toHaveBeenCalledTimes(1);
  expect(model.doStreamCalls).toHaveLength(1);
  const actual = model.doStreamCalls[0];
  const { abortSignal: _s, headers: _h, ...prepared } = actual;
  expect((events.find(e => e.kind === "model-input")?.value as any).prepared).toEqual(
    JSON.parse(JSON.stringify(prepared)),
  );
  expect(actual.maxOutputTokens).toBe(128);
  expect(actual.providerOptions).toEqual({ anthropic: { effort: "low" } });
  expect(events.find(e => e.kind === "model-finish")?.value).toMatchObject({
    usage: { inputTokens: { total: 10 }, outputTokens: { total: 4 } },
  });
  expect(existsSync(path + ".DISPATCHED")).toBe(true);
  expect(external).not.toHaveBeenCalled();
  await expect(execute({ model: MODEL_CHAT, prompt: "duplicate" })).rejects.toThrow(
    "eval_already_dispatched",
  );
  expect(model.doStreamCalls).toHaveLength(1);
});
it.each(["write", "input", "capture"])(
  "blocks %s failure before underlying forward",
  async mode => {
    const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: async () => result() });
    const { execute, path } = setup(
      model,
      mode === "input" ? { maxInputBytes: 1 } : mode === "capture" ? { maxCaptureBytes: 1 } : {},
      (kind, value) => {
        if (mode === "write" && kind === "model-input") throw new Error("disk");
        events.push({ kind, value });
      },
    );
    await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
    expect(model.doStreamCalls).toHaveLength(0);
    expect(existsSync(path + ".DISPATCHED")).toBe(true);
    expect(external).not.toHaveBeenCalled();
  },
);
it("exclusive marker rejects a second executor even after failure", async () => {
  const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: async () => result() });
  const { execute, config } = setup(model);
  const second = createGuardedChatExecution(config);
  const outcomes = await Promise.allSettled([
    execute({ model: MODEL_CHAT, prompt: "q" }),
    second({ model: MODEL_CHAT, prompt: "q" }),
  ]);
  expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(model.doStreamCalls).toHaveLength(1);
});
it("never retries a retryable underlying error", async () => {
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () => {
      throw new APICallError({
        message: "retryable",
        url: "https://example.invalid",
        requestBodyValues: {},
        statusCode: 503,
        isRetryable: true,
      });
    },
  });
  const { execute } = setup(model);
  await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow();
  expect(model.doStreamCalls).toHaveLength(1);
  expect(external).not.toHaveBeenCalled();
});
it("call bound blocks subsequent forward while retaining tool evidence", async () => {
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () => result(true),
  });
  const { execute } = setup(model, { maxCalls: 1 });
  const search = vi.fn(async () => ({
    sources: [{ sourceId: "one", revision: "revision", locator: { start: 1, end: 4 } }],
  }));
  await expect(
    execute({
      model: MODEL_CHAT,
      prompt: "q",
      stopWhen: isStepCount(6),
      tools: {
        searchSources: tool({ inputSchema: z.object({ query: z.string() }), execute: search }),
      },
    }),
  ).rejects.toThrow();
  expect(search).toHaveBeenCalledTimes(1);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(events.some(e => e.kind === "tool-output")).toBe(true);
});
it("advertised unbudgeted tool rejects before any provider forward", async () => {
  const forbidden = vi.fn();
  // The schema remains advertised, but this manifest only budgets saved-source tools.
  const read = tool({ inputSchema: z.object({ query: z.string() }), execute: forbidden });
  const bannedModel = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "tool-call", toolCallId: "x", toolName: "webSearch", input: '{"query":"q"}' },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ],
      }),
    }),
  });
  const banned = setup(bannedModel);
  await expect(
    banned.execute({
      model: MODEL_CHAT,
      prompt: "q",
      stopWhen: isStepCount(6),
      tools: { webSearch: read },
    }),
  ).rejects.toThrow();
  expect(forbidden).not.toHaveBeenCalled();
  expect(bannedModel.doStreamCalls).toHaveLength(0);
  expect(existsSync(banned.path + ".DISPATCHED")).toBe(false);
  expect(external).not.toHaveBeenCalled();
});
it("failure writing tool output prevents the next model call", async () => {
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () => result(true),
  });
  const { execute } = setup(model, {}, (kind, value) => {
    if (kind === "tool-output") throw new Error("write");
    events.push({ kind, value });
  });
  await expect(
    execute({
      model: MODEL_CHAT,
      prompt: "q",
      stopWhen: isStepCount(6),
      tools: {
        searchSources: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ sources: [] }),
        }),
      },
    }),
  ).rejects.toThrow();
  expect(model.doStreamCalls).toHaveLength(1);
  expect(events.some(e => e.kind === "model-input")).toBe(true);
});

it("rejects a different prompt before dispatch", async () => {
  const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: async () => result() });
  const { execute, path } = setup(model);
  await expect(execute({ model: MODEL_CHAT, prompt: "different" })).rejects.toThrow(
    "eval_prompt_mismatch",
  );
  expect(model.doStreamCalls).toHaveLength(0);
  expect(existsSync(path + ".DISPATCHED")).toBe(false);
});

it("retains only bounded response identity fields, without metadata bodies", async () => {
  const metadata = {
    type: "response-metadata" as const,
    id: "response-123",
    modelId: "resolved-model",
    timestamp: new Date("2026-01-01T00:00:00Z"),
    providerMetadata: { example: { privateDetail: "do-not-record" } },
  };
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () => ({
      stream: simulateReadableStream<ModelPart>({
        chunks: [
          metadata,
          { type: "text-start", id: "x" },
          { type: "text-delta", id: "x", delta: "Answer." },
          { type: "text-end", id: "x" },
          { type: "finish", finishReason: { unified: "stop", raw: undefined }, usage },
        ],
      }),
    }),
  });
  const { execute } = setup(model);
  expect(await execute({ model: MODEL_CHAT, prompt: "q" })).toEqual({ text: "Answer." });
  expect(events.find(e => e.kind === "model-response-identity")?.value).toEqual({
    call: 1,
    responseId: "response-123",
    modelId: "resolved-model",
  });
  expect(JSON.stringify(events)).not.toContain("do-not-record");
  expect(JSON.stringify(events)).not.toContain("timestamp");
});

it.each(["id", "modelId"] as const)(
  "rejects oversized response %s without retaining it",
  async field => {
    const metadata = { type: "response-metadata" as const, [field]: "x".repeat(257) };
    const model = new MockLanguageModelV4({
      modelId: MODEL_CHAT,
      doStream: async () => ({
        stream: simulateReadableStream<ModelPart>({ chunks: [metadata] }),
      }),
    });
    const { execute } = setup(model);
    await expect(execute({ model: MODEL_CHAT, prompt: "q" })).rejects.toThrow(
      "eval_response_identity_invalid",
    );
    expect(events.some(e => e.kind === "model-response-identity")).toBe(false);
    expect(model.doStreamCalls).toHaveLength(1);
  },
);

it("changed instructions fail before dispatch without silently rewriting them", async () => {
  const model = new MockLanguageModelV4({ modelId: MODEL_CHAT, doStream: async () => result() });
  const { execute, path } = setup(model);
  await expect(
    execute({ model: MODEL_CHAT, prompt: "q", instructions: "Use webSearch" }),
  ).rejects.toThrow("eval_instructions_mismatch");
  expect(model.doStreamCalls).toHaveLength(0);
  expect(existsSync(path + ".DISPATCHED")).toBe(false);
  expect(external).not.toHaveBeenCalled();
});

it.each([
  "searchSources",
  "readSource",
  "webSearch",
  "searchPdfSources",
  "readPdfSource",
  "readNamedPdf",
])("forwards declared %s unchanged using a mocked adapter", async name => {
  let step = 0;
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () =>
      step++ === 0
        ? {
            stream: simulateReadableStream({
              chunks: [
                {
                  type: "tool-call",
                  toolCallId: "one",
                  toolName: name,
                  input: '{"query":"actual"}',
                },
                { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
              ],
            }),
          }
        : result(),
  });
  const adapter = vi.fn(async (_input: { query: string }) => ({
    text: "Recorded public result",
    sourceId: "fixture",
  }));
  const tools = {
    [name]: tool({
      description: "Unchanged tool description",
      inputSchema: z.object({ query: z.string() }),
      execute: adapter,
    }),
  };
  const { execute } = setup(model, { toolLimits: { [name]: 1 } });
  await execute({ model: MODEL_CHAT, prompt: "q", tools, stopWhen: isStepCount(3) });
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(adapter.mock.calls[0][0]).toEqual({ query: "actual" });
  expect(model.doStreamCalls[0].tools?.[0]).toMatchObject({
    name,
    description: "Unchanged tool description",
  });
  expect(events.find(e => e.kind === "tool-output")?.value).toEqual({
    name,
    result: { text: "Recorded public result", sourceId: "fixture" },
  });
  expect(external).not.toHaveBeenCalled();
});
it.each(["per-tool", "total", "capture"])(
  "blocks parallel external dispatch at %s boundary",
  async boundary => {
    const model = new MockLanguageModelV4({
      modelId: MODEL_CHAT,
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            {
              type: "tool-call",
              toolCallId: "one",
              toolName: "webSearch",
              input: '{"query":"one"}',
            },
            {
              type: "tool-call",
              toolCallId: "two",
              toolName: "webSearch",
              input: '{"query":"two"}',
            },
            { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
          ],
        }),
      }),
    });
    const adapter = vi.fn(async () => ({ results: [] }));
    const { execute } = setup(
      model,
      {
        toolLimits: { webSearch: boundary === "per-tool" ? 1 : 2 },
        maxToolExecutions: boundary === "total" ? 1 : 12,
      },
      (kind, value) => {
        if (boundary === "capture" && kind === "tool-input") throw new Error("disk");
        events.push({ kind, value });
      },
    );
    await expect(
      execute({
        model: MODEL_CHAT,
        prompt: "q",
        tools: {
          webSearch: tool({ inputSchema: z.object({ query: z.string() }), execute: adapter }),
        },
        stopWhen: isStepCount(3),
      }),
    ).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(boundary === "capture" ? 0 : 1);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(external).not.toHaveBeenCalled();
  },
);

it("blocks nested PDF tool-result content before the next model forward", async () => {
  let step = 0;
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () =>
      step++ === 0
        ? {
            stream: simulateReadableStream({
              chunks: [
                {
                  type: "tool-call",
                  toolCallId: "pdf",
                  toolName: "readPdfSource",
                  input: '{"sourceId":"public-pdf"}',
                },
                { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
              ],
            }),
          }
        : result(),
  });
  const { execute } = setup(model, { toolLimits: { readPdfSource: 1 } });
  const executePdf = vi.fn(async () => ({ sourceId: "public-pdf" }));
  await expect(
    execute({
      model: MODEL_CHAT,
      prompt: "q",
      stopWhen: isStepCount(3),
      tools: {
        readPdfSource: tool({
          inputSchema: z.object({ sourceId: z.string() }),
          execute: executePdf,
          toModelOutput: async () => ({
            type: "content" as const,
            value: [
              { type: "text" as const, text: "Public PDF metadata" },
              {
                type: "file" as const,
                mediaType: "application/pdf",
                filename: "fixture.pdf",
                data: {
                  type: "data" as const,
                  data: Buffer.from("%PDF-1.4 tiny offline fixture").toString("base64"),
                },
              },
            ],
          }),
        }),
      },
    }),
  ).rejects.toThrow("eval_nontext_input");
  expect(executePdf).toHaveBeenCalledTimes(1);
  expect(model.doStreamCalls).toHaveLength(1);
  expect(external).not.toHaveBeenCalled();
});

it("preserves Anthropic message-start metadata through a real SDK tool transition", async () => {
  const metadata = {
    anthropic: {
      id: "msg_fixture",
      model: "claude-sonnet-5-5",
      usage: { input_tokens: 2717, output_tokens: 20 },
    },
  };
  const model: MockLanguageModelV4 = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () =>
      model.doStreamCalls.length === 1
        ? {
            stream: simulateReadableStream<ModelPart>({
              chunks: [
                { type: "custom", kind: "anthropic.message_start", providerMetadata: metadata },
                {
                  type: "tool-call",
                  toolCallId: "web",
                  toolName: "webSearch",
                  input: '{"query":"recorded query"}',
                },
                { type: "finish", finishReason: { unified: "tool-calls", raw: "tool_use" }, usage },
              ],
            }),
          }
        : result(),
  });
  const { execute } = setup(model, { toolLimits: { webSearch: 2 } });
  await expect(
    execute({
      model: MODEL_CHAT,
      prompt: "q",
      stopWhen: isStepCount(6),
      tools: {
        webSearch: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ results: [{ snippet: "Full captured text" }] }),
        }),
      },
    }),
  ).resolves.toEqual({ text: "Answer." });
  expect(model.doStreamCalls).toHaveLength(2);
  expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain("anthropic.message_start");
  expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain("Full captured text");
  expect(external).not.toHaveBeenCalled();
});

it("rejects unknown custom content and retains the specific guard reason", async () => {
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async () => ({
      stream: simulateReadableStream<ModelPart>({
        chunks: [
          { type: "custom", kind: "other.unpriced", providerMetadata: {} },
          { type: "tool-call", toolCallId: "t", toolName: "searchSources", input: '{"query":"q"}' },
          { type: "finish", finishReason: { unified: "tool-calls", raw: undefined }, usage },
        ],
      }),
    }),
  });
  const { execute } = setup(model);
  await expect(
    execute({
      model: MODEL_CHAT,
      prompt: "q",
      stopWhen: isStepCount(6),
      tools: {
        searchSources: tool({
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ sources: [] }),
        }),
      },
    }),
  ).rejects.toThrow("eval_nontext_input");
  expect(model.doStreamCalls).toHaveLength(1);
  expect(events.find(e => e.kind === "guard-failure")?.value).toMatchObject({
    reason: "eval_nontext_input",
    calls: 1,
    toolExecutions: 1,
  });
  expect(external).not.toHaveBeenCalled();
});
