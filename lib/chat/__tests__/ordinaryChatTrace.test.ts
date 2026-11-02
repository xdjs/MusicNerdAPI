import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  parseJsonEventStream,
  readUIMessageStream,
  simulateReadableStream,
  uiMessageChunkSchema,
  type UIMessageChunk,
} from "ai";
import { createOfflineChatTrace } from "@/lib/evals/__tests__/helpers/createOfflineChatTrace";
import { originalFixture } from "./originalFixture";

const m = vi.hoisted(() => ({
  model: undefined as unknown,
  originals: vi.fn(),
  loaded: vi.fn(),
  cancelled: vi.fn(),
  reserve: vi.fn(),
  external: vi.fn(() => {
    throw new Error("external_io_blocked");
  }),
}));
vi.mock("node:net", async original => ({
  ...(await original<typeof import("node:net")>()),
  connect: m.external,
  createConnection: m.external,
}));
vi.mock("node:tls", async original => ({
  ...(await original<typeof import("node:tls")>()),
  connect: m.external,
}));
vi.mock("node:http", async original => ({
  ...(await original<typeof import("node:http")>()),
  request: m.external,
  get: m.external,
}));
vi.mock("node:https", async original => ({
  ...(await original<typeof import("node:https")>()),
  request: m.external,
  get: m.external,
}));
vi.mock("@/lib/ai/const", async original => {
  const actual = await original<typeof import("@/lib/ai/const")>();
  return {
    ...actual,
    get MODEL_CHAT() {
      if (!(m.model instanceof MockLanguageModelV4)) throw new Error("offline_model_required");
      return m.model;
    },
  };
});
vi.mock("ai", async original => {
  const actual = await original<typeof import("ai")>();
  return {
    ...actual,
    streamText: (options: Parameters<typeof actual.streamText>[0]) => {
      if (!(m.model instanceof MockLanguageModelV4)) throw new Error("offline_model_required");
      return actual.streamText({
        ...options,
        model: m.model,
        maxRetries: 0,
        maxOutputTokens: 2048,
      });
    },
  };
});
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({
  loadResearchArtist: async () => ({ name: "Example Artist" }),
}));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: async (...args: unknown[]) => {
    const originals = await m.originals(...args);
    m.loaded(originals);
    return originals;
  },
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: async () => "offline-visitor",
}));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: m.reserve,
}));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.external }));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: async () => [] }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.external }));
const { postArtistChatHandler } = await import("@/lib/chat/postArtistChatHandler");
const id = "11111111-1111-4111-8111-111111111111";
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
};
const finish = (unified: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified, raw: undefined },
  usage,
});
const call = (toolName: string, input: object, toolCallId: string) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: "tool-call" as const, toolName, input: JSON.stringify(input), toolCallId },
      finish("tool-calls"),
    ],
  }),
});
const answer = (text: string) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: "text-start" as const, id: "text" },
      { type: "text-delta" as const, id: "text", delta: text },
      { type: "text-end" as const, id: "text" },
      finish("stop"),
    ],
  }),
});
const question = (text: string) => ({ id: "user", role: "user", parts: [{ type: "text", text }] });

beforeEach(() => {
  vi.clearAllMocks();
  m.originals.mockReset();
  m.loaded.mockReset();
  vi.stubGlobal("fetch", m.external);
  m.reserve.mockResolvedValue(undefined);
  m.originals.mockResolvedValue([
    originalFixture(
      "vault:one",
      "https://example.com/article",
      "1975\nA shared recording. Later accounts describe another partnership.",
    ),
  ]);
});
afterEach(() => vi.unstubAllGlobals());

/** Runs ordinary handler and actual SDK loop/client decoder; only external boundaries are substituted. */
async function runInternal(
  script: (ReturnType<typeof answer> | ReturnType<typeof call>)[],
  messages = [question("Describe the recording history.")],
  signal?: AbortSignal,
  onClient?: (message: unknown) => void,
  captureEnabled = true,
  parserFault = false,
  trace = createOfflineChatTrace(),
) {
  const record = (kind: string, value: unknown) => {
    if (captureEnabled) trace.record(kind, value);
  };
  trace.begin("offline-turn");
  record("request-body", { artistId: id, messages });
  let corpus: ReturnType<typeof originalFixture>[] = [];
  m.loaded.mockImplementation((actual: typeof corpus) => {
    corpus = structuredClone(actual);
    record("loader-output", {
      eligibility: "fixture-only, not real DB authorization",
      corpus,
    });
  });
  const cancellation = new AbortController();
  const requestSignal = signal
    ? AbortSignal.any([signal, cancellation.signal])
    : cancellation.signal;
  let index = 0;
  m.model = new MockLanguageModelV4({
    doStream: async options => {
      if (captureEnabled) trace.modelStep(options);
      if (options.abortSignal?.aborted) throw new Error("aborted");
      if (index >= script.length) throw new Error("unexpected_model_step");
      return script[index++];
    },
  });
  const response = await postArtistChatHandler(
    new Request(`http://localhost/api/artist/${id}/chat`, {
      method: "POST",
      body: JSON.stringify({ messages }),
      signal: requestSignal,
    }),
    id,
  );
  const parts: UIMessageChunk[] = [];
  const raw: string[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let firstChunk = true;
  const capture = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      if (parserFault && firstChunk) chunk = new TextEncoder().encode("data: {broken}\n\n");
      firstChunk = false;
      const text = decoder.decode(chunk, { stream: true });
      record("raw-sse", text);
      raw.push(text);
      controller.enqueue(chunk);
    },
    flush() {
      const tail = decoder.decode();
      if (tail) {
        record("raw-sse", tail);
        raw.push(tail);
      }
    },
  });
  const observed = parseJsonEventStream({
    stream: response.body!.pipeThrough(capture),
    schema: uiMessageChunkSchema,
  }).pipeThrough(
    new TransformStream({
      transform(item, controller) {
        if (!item.success) throw new Error("malformed_stream");
        const part = item.value;
        if (captureEnabled && part.type === "text-delta") trace.output(part.delta);
        record("ui-chunk", part);
        parts.push(part);
        controller.enqueue(part);
      },
    }),
  );
  let failure: string | undefined;
  const reader = readUIMessageStream({
    stream: observed,
    onError: error => {
      failure = error instanceof Error ? error.message : "stream_error";
      cancellation.abort(error);
      m.cancelled(cancellation.signal.aborted);
    },
  }).getReader();
  const client = [];
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      client.push(structuredClone(item.value));
      onClient?.(item.value);
    }
  } catch (error) {
    cancellation.abort(error);
    m.cancelled(cancellation.signal.aborted);
    failure = error instanceof Error ? error.message : "capture_or_reader_failure";
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const terminal = {
    outcome: requestSignal.aborted
      ? "aborted"
      : failure || trace.snapshot().failure || parts.some(p => p.type === "error")
        ? "failed"
        : parts.some(p => p.type === "finish") && parts.some(p => p.type === "text-delta")
          ? "completed_transport"
          : "incomplete_no_answer",
    status: response.status,
    finishObserved: parts.some(p => p.type === "finish"),
    errorObserved: parts.some(p => p.type === "error"),
    aborted: requestSignal.aborted,
    failure: failure ?? trace.snapshot().failure ?? null,
  };
  const provenance: unknown[] = [];
  const inputById = new Map(
    parts.filter(p => p.type === "tool-input-available").map(p => [p.toolCallId, p]),
  );
  for (const part of parts) {
    if (part.type !== "tool-output-available") continue;
    const input = inputById.get(part.toolCallId);
    if (input?.toolName !== "readSource") continue;
    const sourceId = (input.input as { sourceId: string }).sourceId;
    const source = corpus.find((s: { sourceId: string }) => s.sourceId === sourceId);
    const output = part.output as {
      text?: string;
      revision?: string;
      start?: number;
      end?: number;
    };
    const start = output.start ?? 0;
    const end = output.end ?? output.text?.length ?? 0;
    const exact =
      !!source &&
      Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      start >= 0 &&
      end >= start &&
      end <= source.text.length &&
      (output.revision === undefined || output.revision === source.revision) &&
      source.text.slice(start, end) === output.text;
    if (source && typeof output.text === "string")
      provenance.push({
        toolCallId: part.toolCallId,
        sourceId,
        revision: source.revision,
        start: exact ? start : null,
        end: exact ? end : null,
        truncatedByRead: output.text.length < source.text.length,
        loaderMetadata: source,
        offsetMeaning: "validated exact original slice, with revision check for contextual reads",
      });
  }
  try {
    if (!trace.snapshot().failure) {
      record("transport-end", terminal);
      for (const item of provenance) record("read-provenance", item);
    }
  } catch (error) {
    terminal.outcome = "capture_incomplete";
    terminal.failure = error instanceof Error ? error.message : "finalization_failure";
  }
  return {
    trace: trace.snapshot(),
    terminal,
    provenance,
    parts,
    client,
    index,
    raw: raw.join(""),
    modelCalls: (m.model as MockLanguageModelV4).doStreamCalls,
  };
}

async function run(...args: Parameters<typeof runInternal>) {
  const trace = createOfflineChatTrace();
  args[6] = trace;
  try {
    return await runInternal(...args);
  } catch (error) {
    return {
      trace: trace.snapshot(),
      terminal: {
        outcome: "setup_or_finalization_failure",
        status: null,
        finishObserved: false,
        errorObserved: false,
        aborted: false,
        failure: error instanceof Error ? error.message : "unknown_failure",
      },
      provenance: [] as unknown[],
      parts: [] as UIMessageChunk[],
      client: [] as Awaited<ReturnType<typeof runInternal>>["client"],
      index: 0,
      raw: "",
      modelCalls: [] as MockLanguageModelV4["doStreamCalls"],
    };
  }
}

it("captures arbitrary actual tool queries/results and model-visible reads with revision/context, without changing normal text", async () => {
  const query = "recording history and partnership scopes";
  const result = await run([
    call("searchSources", { query }, "search-actual"),
    call("readSource", { sourceId: "vault:one" }, "read-actual"),
    answer("A shared recording [1]."),
  ]);
  expect(result.index).toBe(3);
  expect(result.parts).toContainEqual(
    expect.objectContaining({
      type: "tool-input-available",
      toolCallId: "search-actual",
      input: { query },
    }),
  );
  expect(
    JSON.stringify(result.trace.events.filter(e => e.kind === "model-input").at(-1)),
  ).toContain("1975\\nA shared recording");
  expect(JSON.stringify(result.trace.events.find(e => e.kind === "loader-output"))).toContain(
    "revision",
  );
  const sources = result.parts.filter(p => p.type === "source-url");
  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({ sourceId: "1", url: "https://example.com/article" });
  expect(JSON.stringify(result.client.at(-1))).toContain("A shared recording [1].");
  expect(m.external).not.toHaveBeenCalled();
});

it("retains actual truncation evidence instead of claiming late source text reached the model", async () => {
  m.originals.mockResolvedValue([
    originalFixture(
      "vault:one",
      "https://example.com/article",
      "x".repeat(12000) + "QUALIFIER_AFTER_LIMIT",
    ),
  ]);
  const result = await run([
    call("readSource", { sourceId: "vault:one" }, "r"),
    answer("Limited account [1]."),
  ]);
  expect(JSON.stringify(result.trace.events.find(e => e.kind === "loader-output"))).toContain(
    "QUALIFIER_AFTER_LIMIT",
  );
  expect(
    JSON.stringify(result.trace.events.filter(e => e.kind === "model-input").at(-1)),
  ).not.toContain("QUALIFIER_AFTER_LIMIT");
});

it("uses the actual prior SDK message in a follow-up rather than substituting a gold answer", async () => {
  const first = await run([answer("The singer is Example Person.")]);
  const previous = first.client.at(-1)!;
  const second = await run(
    [answer("The sources do not establish a birthplace.")],
    [question("Who sings?"), previous as never, question("Where are they from?")],
  );
  expect(JSON.stringify(second.trace.events.find(e => e.kind === "model-input"))).toContain(
    "Example Person",
  );
});

it("bounds the real SDK loop at six steps without a seventh dispatch", async () => {
  const result = await run(
    Array.from({ length: 6 }, (_, i) => call("searchSources", { query: `query ${i}` }, `s${i}`)),
  );
  expect(result.index).toBe(6);
  expect(result.trace.steps).toBe(6);
  expect(result.terminal.outcome).toBe("incomplete_no_answer");
  expect(result.parts.some(p => p.type === "text-delta")).toBe(false);
});

it("records failure when model trajectory exceeds the scripted allowance, without retry", async () => {
  const result = await run([call("searchSources", { query: "missing answer" }, "s")]);
  expect(result.index).toBe(1);
  expect(result.parts.some(p => p.type === "error")).toBe(true);
  expect(result.trace.steps).toBe(2);
});

it("blocks external networking independently of model substitution", async () => {
  await expect(async () => fetch("https://example.com")).rejects.toThrow("external_io_blocked");
  const net = await import("node:net");
  expect(() => net.connect(443, "example.com")).toThrow("external_io_blocked");
  expect(() => net.createConnection(443, "example.com")).toThrow("external_io_blocked");
  const tls = await import("node:tls");
  expect(() => tls.connect(443, "example.com")).toThrow("external_io_blocked");
  for (const protocol of [await import("node:http"), await import("node:https")]) {
    expect(() => protocol.request("https://example.com")).toThrow("external_io_blocked");
    expect(() => protocol.get("https://example.com")).toThrow("external_io_blocked");
  }
});

it("records abort rather than manufacturing a successful completion", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await run([answer("must not be emitted")], undefined, controller.signal);
  expect(result.parts.some(p => p.type === "text-delta")).toBe(false);
  expect(result.trace.events.find(e => e.kind === "transport-end")?.value).toMatchObject({
    aborted: true,
  });
});

it("does not convert unsupported synthesis into a semantic pass", async () => {
  const result = await run([
    call("readSource", { sourceId: "vault:one" }, "r"),
    answer("An invented guest role [1]."),
  ]);
  expect(JSON.stringify(result.client.at(-1))).toContain("invented guest role");
  expect(result.parts.filter(p => p.type === "source-url")).toHaveLength(1);
  // Demonstrates the actual boundary: source identity is wired, claim entailment is not enforced.
});

it("records only the exact loader snapshot used by the handler", async () => {
  m.originals.mockResolvedValueOnce([
    originalFixture("vault:one", "https://example.com/first", "FIRST_SNAPSHOT"),
  ]);
  m.originals.mockResolvedValueOnce([
    originalFixture("vault:one", "https://example.com/second", "SECOND_SNAPSHOT"),
  ]);
  const result = await run([
    call("readSource", { sourceId: "vault:one" }, "r"),
    answer("First [1]."),
  ]);
  expect(m.originals).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(result.trace)).toContain("FIRST_SNAPSHOT");
  expect(JSON.stringify(result.trace)).not.toContain("SECOND_SNAPSHOT");
});

it("aborts the request when output capture exceeds its bound", async () => {
  const result = await run([
    call("readSource", { sourceId: "vault:one" }, "read"),
    answer("x".repeat(8193)),
  ]);
  expect(result.terminal).toMatchObject({
    failure: "output_limit",
    aborted: true,
    finishObserved: false,
  });
  expect(result.trace.failure).toBe("output_limit");
  expect(result.provenance).toHaveLength(1);
  expect(result.trace.events.some(e => e.kind === "model-input")).toBe(true);
  const model = m.model as MockLanguageModelV4;
  expect(m.cancelled).toHaveBeenCalledWith(true);
  expect(model.doStreamCalls).toHaveLength(2);
});

it("observes an incremental client message before stopping the same request", async () => {
  const cancellation = new AbortController();
  let partialSeen = false;
  const streamed = {
    stream: simulateReadableStream({
      chunkDelayInMs: 10,
      chunks: [
        { type: "text-start" as const, id: "text" },
        { type: "text-delta" as const, id: "text", delta: "partial answer" },
        { type: "text-delta" as const, id: "text", delta: "MUST_NOT_APPEAR" },
        { type: "text-end" as const, id: "text" },
        finish("stop"),
      ],
    }),
  };
  const result = await run([streamed], undefined, cancellation.signal, message => {
    if (JSON.stringify(message).includes("partial answer")) {
      partialSeen = true;
      cancellation.abort();
    }
  });
  expect(partialSeen).toBe(true);
  expect(result.raw).not.toContain("MUST_NOT_APPEAR");
  expect(result.parts.some(p => p.type === "finish")).toBe(false);
  const abortIndex = result.parts.findIndex(p => p.type === "abort");
  expect(abortIndex).toBeGreaterThanOrEqual(0);
  expect(
    result.parts.slice(abortIndex + 1).some(p => p.type === "text-delta" || p.type === "finish"),
  ).toBe(false);
  expect(result.trace.events.find(e => e.kind === "transport-end")?.value).toMatchObject({
    aborted: true,
  });
  expect(result.index).toBe(1);
});

it("preserves model inputs and visible parts with capture on or off", async () => {
  const script = () => [
    call("readSource", { sourceId: "vault:one" }, "r"),
    answer("Supported [1]."),
  ];
  const on = await run(script());
  const off = await run(script(), undefined, undefined, undefined, false);
  expect(on.modelCalls.map(c => c.prompt)).toEqual(off.modelCalls.map(c => c.prompt));
  const visible = (r: typeof on) =>
    r.parts.filter(p => p.type === "text-delta" || p.type === "source-url");
  expect(visible(on)).toEqual(visible(off));
  expect(on.terminal).toEqual(off.terminal);
});

it("rejects a nonmock MODEL_CHAT before invocation independently of streamText override", async () => {
  const invoke = vi.fn();
  m.model = { doStream: invoke };
  const constants = await import("@/lib/ai/const");
  expect(() => constants.MODEL_CHAT).toThrow("offline_model_required");
  expect(invoke).not.toHaveBeenCalled();
  expect(m.external).not.toHaveBeenCalled();
});

it("retains setup capture failure and blocks dispatch", async () => {
  const result = await run([answer("unused")], [question("x".repeat(1_000_001))]);
  expect(result.terminal).toMatchObject({
    outcome: "setup_or_finalization_failure",
    failure: "capture_limit",
  });
  expect(result.trace.events).toHaveLength(1);
  expect(result.index).toBe(0);
});

it("retains input-limit failure before any scripted generation", async () => {
  const result = await run(
    [answer("unused")],
    [{ ...question("x".repeat(130000)), role: "assistant" }, question("Continue")],
  );
  expect(result.terminal.failure).toBe("input_limit");
  expect(result.trace.failure).toBe("input_limit");
  expect(result.index).toBe(0);
});

it("retains bounded capture failure and parser failure instead of returning success", async () => {
  const capture = await run([answer("x".repeat(1_000_001))]);
  expect(capture.terminal).toMatchObject({
    failure: "capture_limit",
    aborted: true,
    finishObserved: false,
  });
  expect(capture.trace.capturedBytes).toBeLessThanOrEqual(1_000_000);
  const parser = await run([answer("unused")], undefined, undefined, undefined, true, true);
  expect(parser.terminal).toMatchObject({
    failure: "malformed_stream",
    aborted: true,
    finishObserved: false,
  });
  expect(parser.trace.events.some(e => e.kind === "raw-sse")).toBe(true);
});

it("captures a non-SSE handler failure with zero generation and no false finish", async () => {
  m.reserve.mockRejectedValueOnce(new Error("offline_quota_failure"));
  const result = await run([answer("unused")]);
  expect(result.terminal).toMatchObject({ status: 503, finishObserved: false });
  expect(result.terminal.outcome).not.toBe("completed_transport");
  expect(result.raw).toContain("Chat is temporarily unavailable");
  expect(result.index).toBe(0);
});

it("does not relabel a genuine completed transport when cancellation happens afterward", async () => {
  const controller = new AbortController();
  const result = await run([answer("complete")], undefined, controller.signal);
  expect(result.terminal.outcome).toBe("completed_transport");
  const lastText = result.parts.findLastIndex(p => p.type === "text-delta");
  expect(result.parts.findIndex(p => p.type === "finish")).toBeGreaterThan(lastText);
  expect(result.parts.some(p => p.type === "error" || p.type === "abort")).toBe(false);
  controller.abort();
  expect(result.terminal.aborted).toBe(false);
});

it("preserves dispatched steps and streamed answer when final provenance exceeds capture capacity", async () => {
  m.originals.mockResolvedValue([
    originalFixture("vault:one", "https://example.com/large", "x".repeat(490000)),
  ]);
  const result = await run([
    call("readSource", { sourceId: "vault:one" }, "r"),
    answer("Completed [1]."),
  ]);
  expect(result.terminal).toMatchObject({
    outcome: "capture_incomplete",
    failure: "capture_limit",
    finishObserved: true,
  });
  expect(result.trace.failure).toBe("capture_limit");
  expect(result.trace.capturedBytes).toBeLessThanOrEqual(1_000_000);
  expect(result.index).toBe(2);
  expect(result.modelCalls).toHaveLength(2);
  expect(result.provenance).toHaveLength(1);
  expect(result.raw).toContain("Completed [1].");
  expect(result.parts.some(p => p.type === "finish")).toBe(true);
});

it("carries a ranked late locator through the actual handler and SDK read into model-visible context", async () => {
  const { rankChatSourceOriginals } = await import("../rankChatSourceOriginals");
  const text =
    "Background. ".repeat(1500) +
    "SECTION\nDub session was provisional, not released." +
    "Tail. ".repeat(2500);
  const source = originalFixture("vault:late", "https://example.com/late", text);
  m.originals.mockResolvedValue([source]);
  const match = rankChatSourceOriginals(
    [source],
    { topic: "dub", evidenceNeed: "reporting", freshness: "stored" },
    "Example Artist",
    8,
  )[0].match!;
  const locator = {
    sourceId: source.sourceId,
    revision: source.revision,
    start: match.start,
    end: match.end,
  };
  const result = await run([
    call("searchSources", { query: "dub" }, "search"),
    call("readSource", { sourceId: source.sourceId, locator }, "read"),
    answer("Provisional [1]."),
  ]);
  expect(result.terminal.outcome).toBe("completed_transport");
  expect(result.index).toBe(3);
  const searchResult = result.parts.find(
    p => p.type === "tool-output-available" && p.toolCallId === "search",
  );
  expect(JSON.stringify(searchResult)).toContain(JSON.stringify(locator));
  expect(
    JSON.stringify(result.trace.events.filter(e => e.kind === "model-input").at(-1)),
  ).toContain("Dub session was provisional, not released.");
  expect(result.provenance[0]).toMatchObject({
    start: expect.any(Number),
    end: expect.any(Number),
    revision: source.revision,
  });
  expect((result.provenance[0] as { start: number }).start).toBeGreaterThan(12000);
  expect(m.external).not.toHaveBeenCalled();
});
