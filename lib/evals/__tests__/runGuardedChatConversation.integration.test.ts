import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToModelMessages, simulateReadableStream, type UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { MODEL_CHAT } from "@/lib/ai/const";
import { originalFixture } from "@/lib/chat/__tests__/originalFixture";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
import { validateArtistChatBody } from "@/lib/chat/validateArtistChatBody";
import { createGuardedChatExecution } from "@/lib/evals/createGuardedChatExecution";
import { runGuardedChatConversation } from "@/lib/evals/runGuardedChatConversation";
import type { streamText } from "@/lib/ai/streamText";

// Control/transport proof only. Scripted choices are not semantic acceptance or live evidence.
const m = vi.hoisted(() => ({ reserve: vi.fn(), current: vi.fn(), external: vi.fn() }));
const source = originalFixture(
  "synthetic-source",
  "https://example.invalid/original",
  "The artist used Alpha and Beta concurrently in 2001.",
);
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({
  loadResearchArtist: async () => ({ name: "Synthetic Artist" }),
}));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: async () => [source],
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: async () => "synthetic-visitor",
}));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: m.reserve,
}));
vi.mock("@/lib/sourcePublication/assertPublicSourceCurrent", () => ({
  assertPublicSourceCurrent: m.current,
}));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: async () => [] }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.external }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.external }));
const artistId = "11111111-1111-4111-8111-111111111111";
const question = "Which years did this artist use each artist alias?";
const followUp =
  "What evidence supports those aliases being used at the same time, and what remains uncertain? Show the exact source pages.";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 4, text: 4, reasoning: undefined },
};
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "mn-pair-integration-"));
  vi.clearAllMocks();
  m.reserve.mockResolvedValue(undefined);
  m.current.mockResolvedValue(undefined);
  m.external.mockImplementation(() => {
    throw new Error("external_operation_forbidden");
  });
  vi.stubGlobal("fetch", m.external);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function run(next = followUp, maxCalls = 6) {
  // Pin actual handler prompt/instructions with only mocked data reads and no model execution.
  let pinned!: Parameters<typeof streamText>[0];
  const response = await postArtistChatHandler(
    new Request("http://localhost/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream; musicnerd-attributed-text=12000",
      },
      body: JSON.stringify({
        messages: [{ id: "preflight", role: "user", parts: [{ type: "text", text: question }] }],
      }),
    }),
    artistId,
    async options => {
      pinned = options;
      return { text: "" };
    },
  );
  await response.text();
  expect(pinned.instructions).toContain("12000 literal UTF-16");
  m.reserve.mockClear();
  const model: MockLanguageModelV4 = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async ({ prompt }) => {
      const call = model.doStreamCalls.length;
      if (call % 2 === 1)
        return {
          stream: simulateReadableStream({
            chunks: [
              {
                type: "tool-call" as const,
                toolCallId: `read-${call}`,
                toolName: "readSource",
                input: JSON.stringify({ sourceId: source.sourceId }),
              },
              {
                type: "finish" as const,
                finishReason: { unified: "tool-calls" as const, raw: undefined },
                usage,
              },
            ],
          }),
        };
      const read = prompt
        .filter(message => message.role === "tool")
        .flatMap(message => message.content)
        .find(part => part.type === "tool-result" && part.toolCallId === `read-${call - 1}`);
      if (!read || read.type !== "tool-result" || read.output.type !== "text")
        throw new Error("missing_actual_read");
      const blocks = JSON.parse(read.output.value).blocks as { id: string }[];
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "selection" },
            {
              type: "text-delta" as const,
              id: "selection",
              delta: JSON.stringify({ blocks: [blocks[0].id] }) + '\n{"end":true}\n',
            },
            { type: "text-end" as const, id: "selection" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: undefined },
              usage,
            },
          ],
        }),
      };
    },
  });
  const raw = JSON.stringify({
    version: 1,
    runId: "pair-integration",
    modelId: MODEL_CHAT,
    promptSha256: hash(JSON.stringify(pinned.prompt)),
    instructionsSha256: hash(JSON.stringify(pinned.instructions)),
    toolLimits: {
      searchSources: 6,
      readSource: 6,
      webSearch: 1,
      searchPdfSources: 6,
      readPdfSource: 2,
      readNamedPdf: 2,
    },
    maxToolExecutions: 8,
    maxCalls,
    maxInputBytes: 128000,
    maxTotalInputBytes: 196608,
    maxOutputTokens: 1024,
    maxOutputCharacters: 8192,
    maxCaptureBytes: 1000000,
  });
  const manifestPath = join(directory, "guard.json");
  writeFileSync(manifestPath, raw, { mode: 0o600 });
  const records: { kind: string; value: Record<string, unknown> }[] = [];
  const review = vi.fn(async (_turn: unknown, _message: UIMessage) => "pass" as const);
  const result = await runGuardedChatConversation({
    artistId,
    question,
    followUp: next,
    requestId: "pair",
    maxCaptureBytes: 1000000,
    createExecution: controls =>
      createGuardedChatExecution({ manifestPath, manifestSha256: hash(raw), model, ...controls }),
    reviewFirst: review,
    write: line => {
      records.push(JSON.parse(line));
    },
  });
  return { result, records, model, review };
}

it("carries actual SDK literal history through the real handler and one shared guard", async () => {
  const { result, records, model, review } = await run();
  expect(result.stopped).toBe("awaiting_followup_quality_review");
  expect(result.turns).toHaveLength(2);
  expect(
    result.turns.every(turn => !turn.error && turn.attribution?.state === "complete-transport"),
  ).toBe(true);
  expect(model.doStreamCalls).toHaveLength(4);
  expect(m.reserve).toHaveBeenCalledTimes(2);
  expect(review).toHaveBeenCalledTimes(1);
  const requests = records.filter(record => record.kind === "request");
  const history = requests[1].value.messages as UIMessage[];
  expect(history[1]).toEqual(review.mock.calls[0][1]);
  expect(history[1].parts.some(part => part.type === "text")).toBe(false);
  expect(JSON.stringify(history[1])).toContain(source.text);
  const normalized = await validateArtistChatBody(
    new Request("http://localhost/chat", {
      method: "POST",
      body: JSON.stringify({ messages: history }),
    }),
  );
  if (normalized instanceof Response) throw new Error("unexpected_invalid_history");
  const prompt = await convertToModelMessages(normalized.messages);
  expect(model.doStreamCalls[2].prompt.filter(message => message.role !== "system")).toEqual(
    prompt,
  );
  expect(JSON.stringify(prompt)).toContain("Prior selected-source navigation hints");
  expect(JSON.stringify(prompt)).not.toContain(source.text);
  expect(
    records.filter(record => record.kind === "model-input").map(record => record.value.call),
  ).toEqual([1, 2, 3, 4]);
  expect(m.external).not.toHaveBeenCalled();
});

it("rejects changed-family instructions before second-turn provider dispatch", async () => {
  const { result, records, model } = await run("Which evidence supports that?");
  expect(result.stopped).toBe("followup_transport_incomplete");
  expect(model.doStreamCalls).toHaveLength(2);
  expect(records.find(record => record.kind === "guard-failure")?.value.reason).toBe(
    "eval_instructions_mismatch",
  );
  expect(result.turns[1].error).toBeTruthy();
  expect(m.external).not.toHaveBeenCalled();
});

it("does not replenish model call allowance between real handler turns", async () => {
  const { result, records, model } = await run(followUp, 2);
  expect(result.stopped).toBe("followup_transport_incomplete");
  expect(model.doStreamCalls).toHaveLength(2);
  expect(records.find(record => record.kind === "guard-failure")?.value).toMatchObject({
    reason: "eval_call_limit",
    calls: 2,
    attemptedCall: 3,
    toolExecutions: 1,
  });
  expect(m.external).not.toHaveBeenCalled();
});
