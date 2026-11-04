import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { convertToModelMessages, simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { MODEL_CHAT } from "@/lib/ai/const";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
import { chatStreamTurn } from "../chatStreamTurn";
import { createGuardedChatExecution } from "../createGuardedChatExecution";

// Actual handler, tools, app streamText, SDK conversion, guard and SSE parser.
// Only external data/provider boundaries are substituted; this is not model-quality evidence.
const m = vi.hoisted(() => ({
  load: vi.fn(),
  read: vi.fn(),
  reserve: vi.fn(),
  external: vi.fn(() => {
    throw new Error("network_forbidden");
  }),
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({
  loadResearchArtist: async () => ({ name: "Fixture Artist" }),
}));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: async () => [],
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: async () => "offline-visitor",
}));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: m.reserve,
}));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.load }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.read }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.external }));
const id = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const binary = readFileSync(
  new URL("../../vaultUpload/__tests__/fixtures/text.pdf", import.meta.url),
);
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const source = {
  id: sourceId,
  title: "fixture.pdf",
  revision: "r1",
  size: binary.length,
  path: `${id}/fixture.pdf`,
  url: "https://example.test/fixture.pdf",
  claimId: null,
};
const pin = {
  sourceId,
  filename: source.title,
  revision: source.revision,
  bytes: binary.length,
  pages: 1,
  sha256: hash(binary),
};
const question = "Describe the artist's aliases.";
const finish = (unified: "stop" | "tool-calls") => ({
  type: "finish" as const,
  finishReason: { unified, raw: undefined },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 2, text: 2, reasoning: undefined },
  },
});
const toolStep = (name: string, input: object, call: string) => ({
  stream: simulateReadableStream({
    chunks: [
      {
        type: "tool-call" as const,
        toolName: name,
        toolCallId: call,
        input: JSON.stringify(input),
      },
      finish("tool-calls"),
    ],
  }),
});
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pdf-handler-"));
  vi.clearAllMocks();
  vi.stubGlobal("fetch", m.external);
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.reserve.mockResolvedValue(undefined);
  m.load.mockResolvedValue([source]);
  m.read.mockResolvedValue({ bytes: binary, pages: 1, hash: pin.sha256 });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function run(revoke = false) {
  const records: { kind: string; value: any }[] = [];
  const record = (kind: string, value: unknown) => records.push({ kind, value });
  const prepared: any[] = [];
  const model = new MockLanguageModelV4({
    modelId: MODEL_CHAT,
    doStream: async params => {
      prepared.push(params);
      switch (prepared.length) {
        case 1:
          return toolStep("searchPdfSources", { query: "aliases" }, "discover");
        case 2:
          return toolStep("readPdfSource", { sourceId }, "read");
        case 3:
          return toolStep("searchSources", { query: "aliases" }, "check-text");
        case 4:
          return {
            stream: simulateReadableStream({
              chunks: [
                { type: "text-start" as const, id: "answer" },
                {
                  type: "text-delta" as const,
                  id: "answer",
                  delta: "Scripted fixture statement [1], physical page 1.",
                },
                { type: "text-end" as const, id: "answer" },
                finish("stop"),
              ],
            }),
          };
        default:
          throw new Error("unexpected_model_forward");
      }
    },
  });
  const prompt = await convertToModelMessages([
    { role: "user", parts: [{ type: "text", text: question }] },
  ]);
  const raw = JSON.stringify({
    version: 1,
    runId: "offline-handler",
    modelId: MODEL_CHAT,
    promptSha256: hash(JSON.stringify(prompt)),
    instructionsSha256: hash(JSON.stringify(buildArtistChatInstructions("Fixture Artist"))),
    toolLimits: {
      searchSources: 6,
      readSource: 6,
      webSearch: 2,
      searchPdfSources: 6,
      readPdfSource: 2,
      readNamedPdf: 2,
    },
    maxToolExecutions: 12,
    maxCalls: 6,
    maxInputBytes: 128000,
    maxTotalInputBytes: 196608,
    maxOutputTokens: 1024,
    maxOutputCharacters: 8192,
    maxCaptureBytes: 1000000,
    pdf: {
      documents: [pin],
      maxUniqueDocuments: 2,
      maxBytesPerCall: binary.length,
      maxTotalBytes: binary.length * 2,
      maxPagesPerCall: 1,
      maxTotalPages: 2,
    },
  });
  const manifestPath = join(dir, "guard.json");
  writeFileSync(manifestPath, raw);
  let validations = 0;
  const execution = createGuardedChatExecution({
    manifestPath,
    manifestSha256: hash(raw),
    model,
    record,
    validatePdfSource: async document => {
      if (revoke && ++validations === 2) m.load.mockResolvedValue([]);
      const current = await m.load(id, document.sourceId);
      if (current.length !== 1 || current[0].revision !== document.revision)
        throw new Error("revoked");
    },
  });
  let claimed = false;
  const turn = await chatStreamTurn(
    { artistId: id, question },
    undefined,
    {
      requestId: "offline-handler",
      claim() {
        if (claimed) throw new Error("duplicate");
        claimed = true;
      },
      record,
      signal: AbortSignal.timeout(10000),
    },
    execution,
  );
  return { turn, records, prepared };
}
it("real handler discovers/reads original PDF, repeats exact SDK bytes and finishes cited SSE", async () => {
  const { turn, records, prepared } = await run();
  expect(turn.error).toBeUndefined();
  expect(turn.answer).toBe("Scripted fixture statement [1], physical page 1.");
  expect(prepared).toHaveLength(4);
  for (const request of prepared) {
    expect(request.providerOptions).toEqual({
      anthropic: { effort: "medium" },
      gateway: { only: ["anthropic"] },
    });
    expect(request.tools.map((t: { name: string }) => t.name).sort()).toEqual([
      "readNamedPdf",
      "readPdfSource",
      "readSource",
      "searchPdfSources",
      "searchSources",
      "webSearch",
    ]);
    expect(request.toolChoice).toEqual({ type: "auto" });
  }
  expect(records.filter(r => r.kind === "tool-input").map(r => r.value.name)).toEqual([
    "searchPdfSources",
    "readPdfSource",
    "searchSources",
  ]);
  expect(m.read).toHaveBeenCalledTimes(1);
  for (const p of prepared.slice(2)) {
    const parts = p.prompt.flatMap((message: any) =>
      Array.isArray(message.content) ? message.content : [],
    );
    const read = parts.find(
      (part: any) => part.type === "tool-result" && part.toolCallId === "read",
    );
    const file = read.output.value.find((v: any) => v.type === "file");
    expect(file.data).toEqual({ type: "data", data: binary.toString("base64") });
    expect(file.filename).toBe(source.title);
  }
  expect(JSON.stringify(records)).not.toContain(binary.toString("base64"));
  const inputs = records.filter(r => r.kind === "model-input");
  expect(inputs.at(-1)?.value).toMatchObject({
    pdfBytes: binary.length,
    pdfPages: 1,
    consumedPdfBytes: binary.length * 2,
    consumedPdfPages: 2,
  });
  expect(JSON.stringify(inputs.at(-1)?.value.prepared)).toContain(pin.sha256);
  expect(turn.sources).toContainEqual({ n: 1, title: source.title, url: source.url });
  expect(
    records.some(
      r => r.kind === "ui-chunk" && r.value.type === "source-url" && r.value.url === source.url,
    ),
  ).toBe(true);
  expect(records.filter(r => r.kind === "terminal").at(-1)?.value).toMatchObject({
    outcome: "completed_transport",
    finished: true,
    aborted: false,
  });
  expect(m.external).not.toHaveBeenCalled();
  expect(m.reserve).toHaveBeenCalledTimes(1);
});
it("revocation at pre-forward validation stops PDF transmission and reports failed terminal, not success", async () => {
  const { turn, records, prepared } = await run(true);
  expect(prepared).toHaveLength(2);
  expect(JSON.stringify(prepared)).not.toContain(binary.toString("base64"));
  expect(turn.answer).toBe("");
  expect(turn.error).toBeTruthy();
  expect(records.find(r => r.kind === "guard-failure")?.value).toMatchObject({
    reason: "eval_pdf_validation_failed",
    consumedPdfBytes: binary.length,
  });
  expect(records.filter(r => r.kind === "terminal").at(-1)?.value.outcome).toBe("failed");
  expect(
    records.some(r => r.kind === "terminal" && r.value.outcome === "completed_transport"),
  ).toBe(false);
  expect(
    records.some(r => r.kind === "ui-chunk" && ["error", "abort"].includes(r.value.type)),
  ).toBe(true);
  expect(m.external).not.toHaveBeenCalled();
});
