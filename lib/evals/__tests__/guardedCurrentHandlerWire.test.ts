import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createGateway } from "ai";
import { MODEL_CHAT, MODEL_FLASH } from "@/lib/ai/const";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
import { syntheticPdfBytes } from "@/lib/chatPdf/__tests__/syntheticPdfBytes";
import { extractOriginalPdfPages } from "@/lib/chatPdf/extractOriginalPdfPages";
import { chatStreamTurn } from "../chatStreamTurn";
import { createGuardedChatExecution } from "../createGuardedChatExecution";
import { preparePdfEvalInput } from "../preparePdfEvalInput";
import { createBoundedChatCapture } from "../createBoundedChatCapture";

// Transport/control proof only: model choices and data boundaries are scripted.
// No actual artist data, database, provider, credentials or Braintrust connection.
const m = vi.hoisted(() => ({ load: vi.fn(), read: vi.fn(), reserve: vi.fn(), external: vi.fn() }));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({
  loadResearchArtist: async () => ({ name: "Synthetic Artist" }),
}));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: async () => [],
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: async () => "synthetic-visitor",
}));
vi.mock("@/lib/questionResearch/reserveQuestionPlanning", () => ({
  reserveQuestionPlanning: m.reserve,
}));
vi.mock("@/lib/sourcePublication/assertPublicSourceCurrent", () => ({
  assertPublicSourceCurrent: m.external,
}));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.load }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.read }));
vi.mock("@/lib/search/webSearch", () => ({ webSearch: m.external }));
const artistId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const defaultBinary = readFileSync(
  new URL("../../vaultUpload/__tests__/fixtures/text.pdf", import.meta.url),
);
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const defaultSource = {
  id: sourceId,
  title: "fixture.pdf",
  revision: "r1",
  size: defaultBinary.length,
  path: `${artistId}/fixture.pdf`,
  url: "https://example.test/fixture.pdf",
  claimId: null,
};
const defaultPin = {
  sourceId,
  filename: defaultSource.title,
  url: defaultSource.url,
  revision: defaultSource.revision,
  bytes: defaultBinary.length,
  pages: 1,
  sha256: hash(defaultBinary),
};
const question = "Which years did this artist use each artist alias?";
let directory: string;
beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), "mn1424-current-wire-"));
  vi.clearAllMocks();
  m.external.mockImplementation(() => {
    throw new Error("external_operation_forbidden");
  });
  vi.stubGlobal("fetch", m.external);
  m.reserve.mockResolvedValue(undefined);
  m.load.mockResolvedValue([defaultSource]);
  const textManifest = await extractOriginalPdfPages(
    defaultBinary,
    defaultPin.sha256,
    AbortSignal.timeout(3000),
  );
  m.read.mockResolvedValue({
    bytes: defaultBinary,
    pages: 1,
    hash: defaultPin.sha256,
    textManifest,
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function rehearsal(
  modelId: typeof MODEL_CHAT | typeof MODEL_FLASH,
  revoke = false,
  provider = modelId.split("/")[0],
  fixture?: { bytes: Buffer; pages: number },
  failCaptureKind?: string,
) {
  const binary = fixture?.bytes ?? defaultBinary;
  const source = fixture ? { ...defaultSource, size: binary.length } : defaultSource;
  const pin = fixture
    ? { ...defaultPin, bytes: binary.length, pages: fixture.pages, sha256: hash(binary) }
    : defaultPin;
  if (fixture) {
    m.load.mockResolvedValue([source]);
    const textManifest = await extractOriginalPdfPages(
      binary,
      pin.sha256,
      AbortSignal.timeout(3000),
    );
    m.read.mockResolvedValue({ bytes: binary, pages: pin.pages, hash: pin.sha256, textManifest });
  }
  // Obtain exact current handler instructions/prompt without duplicating its paragraph.
  // Every data/allowance boundary is mocked in this preflight as well as the turn.
  let options!: Parameters<typeof import("@/lib/ai/streamText").streamText>[0];
  const response = await postArtistChatHandler(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream; musicnerd-attributed-text=12000",
      },
      body: JSON.stringify({
        messages: [{ id: "eval", role: "user", parts: [{ type: "text", text: question }] }],
      }),
    }),
    artistId,
    async value => {
      options = value;
      return { text: "" };
    },
  );
  expect(response.status).toBe(200);
  await response.text();
  expect(options.instructions).toContain("12000 literal UTF-16");
  m.reserve.mockClear();
  const records: { kind: string; value: any }[] = [];
  const capture = createBoundedChatCapture({
    maxBytes: 1000000,
    write: line => {
      const event = JSON.parse(line);
      if (event.kind === failCaptureKind) throw new Error("synthetic private sink failure");
      records.push(event);
    },
  });
  const wire: any[] = [];
  let wireFailure: unknown;
  const usage = { inputTokens: { total: 100 }, outputTokens: { total: 20 } };
  const gateway = createGateway({
    apiKey: "synthetic-not-a-credential",
    baseURL: "https://offline-gateway.invalid/v4/ai",
    fetch: async (url, init) => {
      try {
        expect(String(url)).toBe("https://offline-gateway.invalid/v4/ai/language-model");
        const params = JSON.parse(String(init?.body));
        wire.push(params);
        expect(new Headers(init?.headers).get("ai-language-model-id")).toBe(modelId);
        expect(params.toolChoice).toEqual({ type: "auto" });
        expect(params.tools.map((t: any) => t.name).sort()).toEqual(
          [
            "searchSources",
            "readSource",
            "webSearch",
            "searchPdfSources",
            "readPdfSource",
            "readNamedPdf",
          ].sort(),
        );
        expect(params.maxOutputTokens).toBe(1024);
        expect(params.providerOptions.gateway).toEqual({ only: [provider] });
        if (modelId === MODEL_FLASH) {
          expect(params.providerOptions.google.thinkingConfig.thinkingBudget).toBe(0);
          expect(params.providerOptions.anthropic).toBeUndefined();
        }
        const safe = preparePdfEvalInput(params, new Map([["read", pin]]));
        expect(JSON.stringify(safe.prepared)).not.toContain(binary.toString("base64"));
        if (wire.length >= 3) {
          expect(safe.pdfBytes).toBe(binary.length);
          expect(safe.pdfPages).toBe(pin.pages);
          expect(JSON.stringify(params)).toContain(binary.toString("base64"));
        }
        let chunks: object[];
        if (wire.length <= 3) {
          chunks = [
            {
              type: "tool-call",
              toolCallId:
                wire.length === 1 ? "discover" : wire.length === 2 ? "read" : "check-text",
              toolName:
                wire.length === 1
                  ? "searchPdfSources"
                  : wire.length === 2
                    ? "readPdfSource"
                    : "searchSources",
              input: JSON.stringify(wire.length === 2 ? { sourceId } : { query: "aliases" }),
            },
            { type: "finish", finishReason: { unified: "tool-calls" }, usage },
          ];
        } else {
          const read = params.prompt
            .flatMap((p: any) => (Array.isArray(p.content) ? p.content : []))
            .find((p: any) => p.type === "tool-result" && p.toolCallId === "read");
          const navigation = JSON.parse(read.output.value[0].text);
          const block = navigation.textPages.findLast((p: any) => p.kind === "pdf-page-text")
            .blocks[0].id;
          chunks = [
            { type: "text-start", id: "selection" },
            {
              type: "text-delta",
              id: "selection",
              delta: JSON.stringify({ blocks: [block] }) + '\n{"end":true}\n',
            },
            { type: "text-end", id: "selection" },
            { type: "finish", finishReason: { unified: "stop" }, usage },
          ];
        }
        return new Response(
          [{ type: "response-metadata", id: `synthetic-${wire.length}`, modelId }, ...chunks]
            .map(c => `data: ${JSON.stringify(c)}\n\n`)
            .join(""),
          {
            headers: { "Content-Type": "text/event-stream" },
          },
        );
      } catch (error) {
        wireFailure = error;
        throw error;
      }
    },
  });
  const raw = JSON.stringify({
    version: 1,
    runId: "synthetic-current",
    modelId,
    provider,
    promptSha256: hash(JSON.stringify(options.prompt)),
    instructionsSha256: hash(JSON.stringify(options.instructions)),
    toolLimits: {
      searchSources: 6,
      readSource: 6,
      webSearch: 1,
      searchPdfSources: 6,
      readPdfSource: 2,
      readNamedPdf: 2,
    },
    maxToolExecutions: 8,
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
      maxTotalBytes: binary.length * 5,
      maxPagesPerCall: pin.pages,
      maxTotalPages: pin.pages * 5,
    },
  });
  const path = join(directory, "manifest.json");
  writeFileSync(path, raw);
  let validations = 0;
  const execution = createGuardedChatExecution({
    manifestPath: path,
    manifestSha256: hash(raw),
    model: gateway(modelId),
    record: capture.record,
    validatePdfSource: async document => {
      if (revoke && ++validations === 2) m.load.mockResolvedValue([]);
      const current = await m.load(artistId, document.sourceId);
      if (current.length !== 1 || current[0].revision !== document.revision)
        throw new Error("source withdrawn");
    },
  });
  let claimed = false;
  const turn = await chatStreamTurn(
    { artistId, question, attributedTextCharacters: 12000 },
    undefined,
    {
      requestId: "synthetic-current",
      claim() {
        if (claimed) throw new Error("duplicate");
        claimed = true;
      },
      record: capture.record,
      signal: AbortSignal.any([AbortSignal.timeout(10000), capture.signal]),
    },
    execution,
  );
  if (wireFailure) throw wireFailure;
  return { turn, wire, records, pin, binary, capture: capture.snapshot() };
}

it.each([MODEL_CHAT, MODEL_FLASH] as const)(
  "current handler / installed SDK / Gateway %s preserves PDF identity and bounded reference capture",
  async modelId => {
    const { turn, wire, records, pin, binary } = await rehearsal(modelId);
    expect(turn.error).toBeUndefined();
    expect(records.find(r => r.kind === "terminal")?.value).toMatchObject({
      outcome: "completed_transport",
      finished: true,
      aborted: false,
    });
    expect(turn.attribution?.state).toBe("complete-transport");
    expect(turn.firstPassageMs).toBeTypeOf("number");
    expect(wire).toHaveLength(4);
    expect(records.filter(r => r.kind === "model-input")).toHaveLength(4);
    expect(records.find(r => r.kind === "model-input" && r.value.call === 3)?.value).toMatchObject({
      pdfBytes: binary.length,
      pdfPages: pin.pages,
      binaryCapture: "verified-reference-only",
    });
    expect(records.find(r => r.kind === "model-input" && r.value.call === 4)?.value).toMatchObject({
      consumedPdfBytes: binary.length * 2,
      consumedPdfPages: pin.pages * 2,
    });
    expect(JSON.stringify(records)).not.toContain(binary.toString("base64"));
    expect(m.reserve).toHaveBeenCalledTimes(1);
    expect(m.external).not.toHaveBeenCalled();
  },
);

it("withdrawal before PDF forward consumes the attempt and emits failed/partial terminal", async () => {
  const { turn, wire, records } = await rehearsal(MODEL_FLASH, true);
  expect(wire).toHaveLength(2);
  expect(records.find(r => r.kind === "terminal")?.value.outcome).toBe("failed");
  expect(turn.attribution?.state).not.toBe("complete-transport");
  expect(
    records.some(
      r => r.kind === "guard-failure" && r.value.reason === "eval_pdf_validation_failed",
    ),
  ).toBe(true);
  expect(m.external).not.toHaveBeenCalled();
});

it("explicit Vertex recipient stays pinned in the complete synthetic PDF route", async () => {
  const { turn, wire, records } = await rehearsal(MODEL_FLASH, false, "vertex");
  expect(turn.error).toBeUndefined();
  expect(wire).toHaveLength(4);
  expect(records.filter(r => r.kind === "model-response-identity")).toHaveLength(4);
  expect(
    records
      .filter(r => r.kind === "model-response-identity")
      .every(r => r.value.modelId === MODEL_FLASH),
  ).toBe(true);
  expect(m.external).not.toHaveBeenCalled();
});

it("keeps a page after unavailable text selectable, preserves all physical positions and remains unscored for completeness", async () => {
  const bytes = syntheticPdfBytes([
    "An attributed account.",
    "",
    "A qualification after the empty page.",
  ]);
  const { turn, wire, records, pin } = await rehearsal(MODEL_FLASH, false, "vertex", {
    bytes,
    pages: 3,
  });
  expect(turn.error).toBeUndefined();
  expect(turn.attribution?.state).toBe("complete-transport");
  expect(turn.attribution?.pdfTextUnavailable).toBe(true);
  expect(turn.attribution?.passages[0]).toMatchObject({
    physicalPage: 3,
    physicalPages: 3,
    originalSha256: pin.sha256,
    text: "A qualification after the empty page.",
  });
  expect(turn.evidence?.map(e => e.physicalPage)).toEqual([1, 3]);
  expect(turn.capture?.reads[0]).toMatchObject({
    complete: false,
    totalPages: 3,
    originalSha256: pin.sha256,
  });
  expect(turn.evidenceCaptureComplete).toBe(false);
  expect(wire).toHaveLength(4);
  expect(JSON.stringify(records)).not.toContain(bytes.toString("base64"));
  expect(m.external).not.toHaveBeenCalled();
});

it("shared outer-event sink failure aborts before another SDK forward and never reports success", async () => {
  const result = await rehearsal(MODEL_FLASH, false, "vertex", undefined, "server-tool-event");
  expect(result.capture.failure).toBe("eval_capture_write");
  expect(result.wire.length).toBeLessThanOrEqual(1);
  expect(result.turn.attribution?.state).not.toBe("complete-transport");
  expect(result.capture.reservedBytes).toBeGreaterThan(result.capture.writtenBytes);
  expect(m.external).not.toHaveBeenCalled();
});

it("production Sonnet identity/effort and all six tools are preserved when Vertex is explicitly approved", async () => {
  const { turn, wire } = await rehearsal(MODEL_CHAT, false, "vertex");
  expect(turn.error).toBeUndefined();
  expect(wire).toHaveLength(4);
  expect(wire.every(p => p.providerOptions.gateway.only[0] === "vertex")).toBe(true);
});
