import { runSingleGuardedChatTurn } from "@/lib/evals/runSingleGuardedChatTurn";
import { getChatCorpusFingerprint } from "@/lib/chat/getChatCorpusFingerprint";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
const m = vi.hoisted(() => ({
  artist: vi.fn(),
  sources: vi.fn(),
  visitor: vi.fn(),
  pdf: vi.fn(),
  pdfRead: vi.fn(),
  turn: vi.fn(),
  guard: vi.fn(),
  gateway: vi.fn(),
}));
vi.mock("@/lib/questionResearch/loadResearchArtist", () => ({ loadResearchArtist: m.artist }));
vi.mock("@/lib/questionResearch/loadPublicResearchOriginals", () => ({
  loadPublicResearchOriginals: m.sources,
}));
vi.mock("@/lib/questionResearch/getQuestionVisitorKey", () => ({
  getQuestionVisitorKey: m.visitor,
}));
vi.mock("@/lib/chatPdf/loadChatPdfs", () => ({ loadChatPdfs: m.pdf }));
vi.mock("@/lib/chatPdf/readChatPdf", () => ({ readChatPdf: m.pdfRead }));
vi.mock("@/lib/evals/chatStreamTurn", () => ({ chatStreamTurn: m.turn }));
vi.mock("@/lib/evals/createGuardedChatExecution", () => ({ createGuardedChatExecution: m.guard }));
vi.mock("ai", async original => ({
  ...(await original<typeof import("ai")>()),
  gateway: m.gateway,
}));
const dirs: string[] = [];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "single-case-"));
  dirs.push(dir);
  const manifest = {
    version: 2,
    provider: "anthropic",
    enabled: true,
    utcDate: new Date().toISOString().slice(0, 10),
    attributedTextCharacters: 12000,
    corpusSha256: getChatCorpusFingerprint(
      (overrides as any).pdf ? [] : [{ sourceId: "one", revision: "r", text: "Public fixture" }],
    ),
    promptSha256: hash(
      JSON.stringify([{ role: "user", content: [{ type: "text", text: "Question" }] }]),
    ),
    artistId: "11111111-1111-4111-8111-111111111111",
    artistName: "Artist",
    question: "Question",
    stagingOriginSha256: hash("https://abcdefghijklmnopqrst.supabase.co"),
    instructionsSha256: hash(JSON.stringify(buildArtistChatInstructions("Artist"))),
    toolSchemasSha256: "a".repeat(64),
    files: { "package.json": hash(readFileSync("package.json", "utf8")) },
    ...overrides,
  };
  const raw = JSON.stringify(manifest),
    path = join(dir, "manifest.json");
  writeFileSync(path, raw);
  for (const [k, v] of Object.entries({
    CHAT_SINGLE_MANIFEST_SHA256: hash(raw),
    VERCEL: "1",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "123",
    GITHUB_SHA: "a".repeat(40),
    CHAT_SINGLE_EXPECTED_SHA: "a".repeat(40),
    AI_GATEWAY_API_KEY: "fixture",
    TAVILY_API_KEY: "fixture",
    SUPABASE_DB_CONNECTION:
      "postgres://fixture:fixture@db.abcdefghijklmnopqrst.supabase.co/postgres",
    SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    MUSICNERD_RESEARCH_API_KEY: "fixture",
    BRAINTRUST_API_KEY: "fixture",
    RUNNER_TEMP: dir,
  }))
    vi.stubEnv(k, v);
  m.artist.mockResolvedValue({ name: "Artist" });
  m.sources.mockResolvedValue(
    (overrides as any).pdf ? [] : [{ sourceId: "one", revision: "r", text: "Public fixture" }],
  );
  m.visitor.mockResolvedValue("visitor");
  m.pdf.mockResolvedValue([]);
  m.pdfRead.mockResolvedValue({ hash: "b".repeat(64), pages: 1, bytes: Buffer.alloc(100) });
  m.guard.mockReturnValue(vi.fn());
  m.turn.mockImplementation(async (_input, _clock, capture) => {
    capture.claim();
    capture.record("server-tool-event", {
      type: "data-chat-corpus-pin",
      data: { sha256: manifest.corpusSha256 },
    });
    return { answer: "fixture", sources: [], firstTextMs: 1, totalMs: 2 };
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("network_forbidden");
    }),
  );
  return path;
}
it.each(["disabled", "rerun", "target", "date", "pdf"])(
  "rejects %s before handler admission or model construction",
  async failure => {
    const path = setup(
      failure === "disabled"
        ? { enabled: false }
        : failure === "date"
          ? { utcDate: "2000-01-01" }
          : {},
    );
    if (failure === "rerun") vi.stubEnv("GITHUB_RUN_ATTEMPT", "2");
    if (failure === "target") vi.stubEnv("SUPABASE_URL", "https://wrong.supabase.co");
    if (failure === "pdf") m.pdf.mockResolvedValue([{ id: "pdf" }]);
    await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.gateway).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("claims once, uses real-boundary names without fixture overrides, and retains private evidence", async () => {
  const path = setup();
  const result = (await runSingleGuardedChatTurn(path)) as any;
  expect(m.sources).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(result.diagnostic.records[0].kind).toBe("source-preflight");
  const guard = JSON.parse(readFileSync(m.guard.mock.calls[0][0].manifestPath, "utf8"));
  expect(guard).toMatchObject({
    maxInputBytes: 128000,
    maxTotalInputBytes: 196608,
    maxCalls: 6,
    maxOutputTokens: 1024,
    maxToolExecutions: 12,
    toolLimits: { webSearch: 2 },
  });
  expect(result.diagnostic.reservationUsd).toBe(0.65);
  expect(result.diagnostic.invoiceGuarantee).toBe(false);
  expect(m.turn.mock.calls[0][0]).toEqual({
    artistId: "11111111-1111-4111-8111-111111111111",
    question: "Question",
    attributedTextCharacters: 12000,
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

it("private record write failure stops before handler and model construction", async () => {
  const path = setup();
  const directory = join(process.env.RUNNER_TEMP!, "chat-single-123");
  mkdirSync(join(directory, "trace.jsonl"), { recursive: true });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.turn).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
it("schema pin rejects changed prepared catalog through the guard record callback", async () => {
  const path = setup();
  m.guard.mockImplementation(
    config => async () =>
      config.record("model-input", { prepared: { tools: [{ name: "changed" }] } }),
  );
  m.turn.mockImplementation(async (_input, _clock, capture, execute) => {
    capture.claim();
    capture.record("server-tool-event", {
      type: "data-chat-corpus-pin",
      data: {
        sha256: getChatCorpusFingerprint([
          { sourceId: "one", revision: "r", text: "Public fixture" },
        ]),
      },
    });
    return execute({});
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_tool_schema_mismatch");
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

it("malformed connection never includes credential input in its error", async () => {
  const path = setup();
  vi.stubEnv("SUPABASE_DB_CONNECTION", "PRIVATE_SENTINEL invalid");
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_runtime_url_invalid");
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it.each(["", " \n\t"])(
  "reports first text as unavailable for a nonsubstantive answer %j",
  async answer => {
    const path = setup();
    m.turn.mockResolvedValue({
      answer,
      sources: [],
      firstTextMs: 8144,
      totalMs: 8144,
      error: "Aborted UI stream.",
    });
    const result = (await runSingleGuardedChatTurn(path)) as any;
    expect(result.firstTextMs).toBeNull();
    expect(result.totalMs).toBe(8144);
    expect(result.error).toBe("Aborted UI stream.");
    expect(fetch).not.toHaveBeenCalled();
  },
);

const pdfPin = {
  sourceId: "22222222-2222-4222-8222-222222222222",
  revision: "r1",
  filename: "fixture.pdf",
  bytes: 100,
  pages: 1,
  sha256: "b".repeat(64),
};
const pdfRow = {
  id: pdfPin.sourceId,
  revision: pdfPin.revision,
  title: pdfPin.filename,
  size: 100,
  path: "artist/fixture.pdf",
  url: "https://fixture.test/artist/fixture.pdf",
  claimId: "claim",
};
const pdfPlan = {
  urlSha256: { [pdfPin.sourceId]: hash("https://fixture.test/artist/fixture.pdf") },
  execution: {
    maxCalls: 6,
    maxToolExecutions: 8,
    maxWebSearches: 1,
    maxInputBytes: 262144,
    maxTotalInputBytes: 1048576,
    maxCaptureBytes: 4194304,
  },
  admission: {
    documents: [pdfPin],
    maxUniqueDocuments: 2,
    maxBytesPerCall: 100,
    maxTotalBytes: 500,
    maxPagesPerCall: 1,
    maxTotalPages: 5,
  },
  reservationUsd: 7.1,
};
it.each(["claim", null])(
  "opt-in PDF runner accepts eligible claim correspondence %s without changing tools",
  async claimId => {
    const path = setup({ pdf: pdfPlan });
    m.pdf.mockResolvedValue([{ ...pdfRow, claimId }]);
    m.sources.mockResolvedValue([]);
    const result = (await runSingleGuardedChatTurn(path)) as any;
    const config = m.guard.mock.calls[0][0];
    const guard = JSON.parse(readFileSync(config.manifestPath, "utf8"));
    expect(guard.pdf).toEqual({
      ...pdfPlan.admission,
      documents: [{ ...pdfPin, url: pdfRow.url }],
    });
    expect(guard).toMatchObject({
      maxCalls: 6,
      maxToolExecutions: 8,
      toolLimits: { webSearch: 1, readPdfSource: 2, readNamedPdf: 2 },
      maxInputBytes: 262144,
      maxTotalInputBytes: 1048576,
      maxOutputTokens: 1024,
    });
    expect(Object.keys(guard.toolLimits)).toHaveLength(6);
    await expect(config.validatePdfSource(pdfPin)).resolves.toBeUndefined();
    expect(m.pdf).toHaveBeenLastCalledWith("11111111-1111-4111-8111-111111111111", pdfPin.sourceId);
    expect(result.diagnostic.reservationUsd).toBe(7.1);
    expect(
      result.diagnostic.records.find((r: any) => r.kind === "pdf-preflight")?.value,
    ).toMatchObject({
      documents: [pdfPin],
      binaryCapture: "verified-reference-only",
    });
    expect(fetch).not.toHaveBeenCalled();
  },
);
it.each(["missing", "calls", "tools", "web"])(
  "rejects unreviewed PDF execution %s limits before model construction",
  async kind => {
    const execution = {
      ...pdfPlan.execution,
      ...(kind === "calls"
        ? { maxCalls: 7 }
        : kind === "tools"
          ? { maxToolExecutions: 12 }
          : { maxWebSearches: 2 }),
    };
    const path = setup({
      pdf: { ...pdfPlan, execution: kind === "missing" ? undefined : execution },
    });
    m.pdf.mockResolvedValue([pdfRow]);
    await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
    expect(m.guard).not.toHaveBeenCalled();
    expect(m.turn).not.toHaveBeenCalled();
    expect(m.gateway).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it.each(["extra", "missing", "revision", "size", "title"])(
  "rejects PDF corpus %s drift before model construction",
  async kind => {
    const path = setup({ pdf: pdfPlan });
    m.pdf.mockResolvedValue(
      kind === "extra"
        ? [pdfRow, { ...pdfRow, id: "other" }]
        : kind === "missing"
          ? []
          : [
              {
                ...pdfRow,
                ...(kind === "revision"
                  ? { revision: "new" }
                  : kind === "size"
                    ? { size: 101 }
                    : { title: "other.pdf" }),
              },
            ],
    );
    await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_pdf_corpus_mismatch");
    expect(m.gateway).not.toHaveBeenCalled();
    expect(m.turn).not.toHaveBeenCalled();
  },
);
it.each(["revoked", "revision", "path", "url", "claim", "foreign"])(
  "revalidates %s after PDF preflight",
  async kind => {
    const path = setup({ pdf: pdfPlan });
    m.pdf.mockResolvedValue([pdfRow]);
    await runSingleGuardedChatTurn(path);
    const validate = m.guard.mock.calls[0][0].validatePdfSource;
    m.pdf.mockResolvedValue(
      kind === "revoked"
        ? []
        : [
            {
              ...pdfRow,
              ...(kind === "revision"
                ? { revision: "new" }
                : kind === "path"
                  ? { path: "other" }
                  : kind === "url"
                    ? { url: "https://other.test" }
                    : kind === "foreign"
                      ? { id: "other" }
                      : { claimId: "new" }),
            },
          ],
    );
    await expect(validate(pdfPin)).rejects.toThrow("single_pdf_source_changed");
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("does not enable PDF admission from an unreviewed or disabled manifest", async () => {
  const path = setup({ pdf: pdfPlan, enabled: false });
  m.pdf.mockResolvedValue([pdfRow]);
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.guard).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
});

it("rejects claim correspondence drift from an unclaimed public baseline", async () => {
  const path = setup({ pdf: pdfPlan });
  m.pdf.mockResolvedValue([{ ...pdfRow, claimId: null }]);
  await runSingleGuardedChatTurn(path);
  const validate = m.guard.mock.calls[0][0].validatePdfSource;
  m.pdf.mockResolvedValue([pdfRow]);
  await expect(validate(pdfPin)).rejects.toThrow("single_pdf_source_changed");
  expect(fetch).not.toHaveBeenCalled();
});

it("read-only preflight can report an unpinned corpus without claims, model construction or a turn", async () => {
  const path = setup({ enabled: false, corpusSha256: undefined });
  const result = await runSingleGuardedChatTurn(path, { preflightOnly: true });
  expect(result.preflight).toMatchObject({
    ready: false,
    sourceCount: 1,
    pdfCount: 0,
    model: "anthropic/claude-sonnet-5.5",
  });
  expect(m.guard).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
});
it("checks complete source corpus changes before model construction", async () => {
  const path = setup();
  m.sources.mockResolvedValue([{ sourceId: "one", revision: "changed", text: "Public fixture" }]);
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_source_corpus_mismatch");
  expect(m.gateway).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
});

it.each([
  "postgres://actor.abcdefghijklmnopqrst:synthetic@foreign.invalid/postgres",
  "https://actor.abcdefghijklmnopqrst:synthetic@aws-0-us-east-1.pooler.supabase.com/postgres",
])("rejects foreign or non-Postgres endpoints before loaders", async value => {
  const path = setup();
  vi.stubEnv("SUPABASE_DB_CONNECTION", value);
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_staging_target_mismatch");
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.sources).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
});
it("rejects actual-handler corpus drift after preflight without substituting sources", async () => {
  const path = setup();
  m.turn.mockImplementation(async (_input, _clock, capture) => {
    capture.claim();
    capture.record("server-tool-event", {
      type: "data-chat-corpus-pin",
      data: { sha256: "f".repeat(64) },
    });
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_handler_corpus_mismatch");
  expect(m.turn).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});

it("returns a safe failed receipt when a private write leaves an unreadable JSONL tail", async () => {
  const path = setup();
  m.turn.mockImplementation(async (_input, _clock, capture) => {
    capture.claim();
    capture.record("server-tool-event", {
      type: "data-chat-corpus-pin",
      data: {
        sha256: getChatCorpusFingerprint([
          { sourceId: "one", revision: "r", text: "Public fixture" },
        ]),
      },
    });
    writeFileSync(join(process.env.RUNNER_TEMP!, "chat-single-123", "trace.jsonl"), "{partial", {
      flag: "a",
    });
    return {
      answer: "Already delivered fixture",
      sources: [],
      firstTextMs: 1,
      totalMs: 2,
      evidenceCaptureComplete: true,
    };
  });
  const result = (await runSingleGuardedChatTurn(path)) as any;
  expect(result.error).toBe("single_trace_unreadable");
  expect(result.diagnostic.traceReadable).toBe(false);
  expect(result.diagnostic.records).toEqual([]);
  expect(result.evidenceCaptureComplete).toBe(false);
  expect(
    readFileSync(join(process.env.RUNNER_TEMP!, "chat-single-123", "trace.jsonl"), "utf8"),
  ).toContain("{partial");
});
it("accepts only the recognized pooled hostname and matching project correspondence", async () => {
  const path = setup();
  vi.stubEnv(
    "SUPABASE_DB_CONNECTION",
    "postgres://mnapi.abcdefghijklmnopqrst:synthetic@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
  );
  const result = await runSingleGuardedChatTurn(path, { preflightOnly: true });
  expect(result.preflight?.ready).toBe(true);
  expect(m.turn).not.toHaveBeenCalled();
});

it("pins the entire eligible PDF catalog, including new discovery-only entries", async () => {
  const path = setup({ pdf: pdfPlan });
  m.pdf.mockResolvedValue([pdfRow]);
  await runSingleGuardedChatTurn(path);
  const validate = m.guard.mock.calls[0][0].validatePdfCatalog;
  await expect(validate()).resolves.toBeUndefined();
  m.pdf.mockResolvedValue([pdfRow, { ...pdfRow, id: "33333333-3333-4333-8333-333333333333" }]);
  await expect(validate()).rejects.toThrow("single_pdf_catalog_changed");
});

it("can pin another supported provider of the SAME production model, never a different evaluator model", async () => {
  const path = setup({ provider: "vertex" });
  await runSingleGuardedChatTurn(path);
  expect(m.gateway).toHaveBeenCalledWith("anthropic/claude-sonnet-5.5");
  expect(JSON.parse(readFileSync(m.guard.mock.calls[0][0].manifestPath, "utf8"))).toMatchObject({
    modelId: "anthropic/claude-sonnet-5.5",
    provider: "vertex",
  });
});
it("rejects a model substitution in the actual-flow manifest", async () => {
  const path = setup({ modelId: "google/gemini-2.5-flash" });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.gateway).not.toHaveBeenCalled();
});

it.each([
  "https://user:synthetic@abcdefghijklmnopqrst.supabase.co",
  "https://abcdefghijklmnopqrst.supabase.co/foreign",
])("rejects non-public-origin binding before loaders", async origin => {
  const path = setup();
  vi.stubEnv("SUPABASE_URL", origin);
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_staging_target_mismatch");
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.turn).not.toHaveBeenCalled();
});

it.each(["hash", "pages", "bytes"])(
  "rejects original PDF %s drift before model/claim/turn",
  async kind => {
    const path = setup({ pdf: pdfPlan });
    m.pdf.mockResolvedValue([pdfRow]);
    m.pdfRead.mockResolvedValue({
      hash: kind === "hash" ? "f".repeat(64) : pdfPin.sha256,
      pages: kind === "pages" ? 2 : 1,
      bytes: Buffer.alloc(kind === "bytes" ? 101 : 100),
    });
    await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("single_pdf_original_mismatch");
    expect(m.gateway).not.toHaveBeenCalled();
    expect(m.turn).not.toHaveBeenCalled();
  },
);

it("rejects a manifest containing database-origin URLs instead of static URL hashes", async () => {
  const path = setup({
    pdf: {
      ...pdfPlan,
      admission: { ...pdfPlan.admission, documents: [{ ...pdfPin, url: pdfRow.url }] },
    },
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow();
  expect(m.artist).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
});

it("rejects a paired manifest through the single-turn entrypoint before reading sources", async () => {
  const path = setup({
    conversation: {
      apiSha: "a".repeat(40),
      webSha: "b".repeat(40),
      model: "anthropic/claude-sonnet-5.5",
      followUp: "What evidence supports those aliases?",
      maxTurns: 2,
      maxDurationMs: 300000,
      firstQualityGate: "human",
    },
  });
  await expect(runSingleGuardedChatTurn(path)).rejects.toThrow("pair_mode_mismatch");
  expect(m.sources).not.toHaveBeenCalled();
  expect(m.gateway).not.toHaveBeenCalled();
});

function setupPair(overrides: Record<string, unknown> = {}) {
  const paths = [
    ...["lib", "app"].flatMap(root =>
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter(
          entry =>
            entry.isFile() &&
            /\.tsx?$/.test(entry.name) &&
            !entry.name.includes(".test.") &&
            !entry.parentPath.split("/").includes("__tests__"),
        )
        .map(entry => `${entry.parentPath}/${entry.name}`),
    ),
    "evals/chat-pair.ts",
    "evals/buildChatPair.mjs",
    "package.json",
    "pnpm-lock.yaml",
    "tsconfig.json",
    "lib/evals/runSingleGuardedChatTurn.ts",
    "lib/evals/runPairedGuardedChatTurn.ts",
    "lib/ai/const.ts",
    "lib/evals/runGuardedChatConversation.ts",
    "lib/evals/createGuardedChatExecution.ts",
    "lib/evals/createBoundedChatCapture.ts",
    "lib/evals/chatStreamTurn.ts",
    "lib/chat/validateArtistChatBody.ts",
    "lib/attributedChat/normalizeChatHistoryParts.ts",
  ];
  const path = setup({
    pdf: pdfPlan,
    toolSchemasSha256: hash(JSON.stringify([])),
    files: Object.fromEntries(paths.map(path => [path, hash(readFileSync(path, "utf8"))])),
    conversation: {
      apiSha: "a".repeat(40),
      webSha: "b".repeat(40),
      model: "anthropic/claude-sonnet-5.5",
      followUp: "What evidence supports those aliases?",
      maxTurns: 2,
      maxDurationMs: 300000,
      firstQualityGate: "human",
    },
    ...overrides,
  });
  vi.stubEnv("CHAT_PAIR_MANIFEST_SHA256", hash(readFileSync(path, "utf8")));
  vi.stubEnv("CHAT_PAIR_EXPECTED_SHA", "a".repeat(40));
  vi.stubEnv("CHAT_PAIR_EXPECTED_WEB_SHA", "b".repeat(40));
  m.pdf.mockResolvedValue([pdfRow]);
  m.turn.mockImplementation(async (_input, _clock, capture) => {
    capture.claim();
    capture.record("server-tool-event", {
      type: "data-chat-corpus-pin",
      data: { sha256: getChatCorpusFingerprint([]) },
    });
    m.guard.mock.calls[0][0].record("model-input", { prepared: { tools: [] } });
    for (const chunk of [
      { type: "start", messageId: "actual" },
      { type: "text-start", id: "text" },
      { type: "text-delta", id: "text", delta: "Actual answer" },
      { type: "text-end", id: "text" },
      { type: "finish", finishReason: "stop" },
    ])
      capture.record("ui-chunk", chunk);
    return {
      answer: "Actual answer",
      sources: [],
      evidenceCaptureComplete: true,
      firstTextMs: 1,
      totalMs: 2,
    };
  });
  return path;
}
it("pins a pair independently, creates one shared guard/ledger and rejects replay", async () => {
  const path = setupPair();
  const reviewFirst = vi.fn(async () => "pass" as const);
  const result = await runSingleGuardedChatTurn(path, { conversation: { reviewFirst } });
  expect(result).toMatchObject({ stopped: "awaiting_followup_quality_review" });
  expect(m.turn).toHaveBeenCalledTimes(2);
  expect(m.guard).toHaveBeenCalledOnce();
  expect(reviewFirst).toHaveBeenCalledOnce();
  expect(m.turn.mock.calls[1][0].messages[1].parts).toContainEqual({
    type: "text",
    text: "Actual answer",
    state: "done",
  });
  const ledger = readFileSync(
    join(process.env.RUNNER_TEMP!, "chat-pair-123", "trace.jsonl"),
    "utf8",
  )
    .trim()
    .split("\n")
    .map(line => JSON.parse(line));
  expect(ledger.filter(r => r.kind === "first-quality-review")).toEqual([
    expect.objectContaining({
      value: expect.objectContaining({
        verdict: "pass",
        outputSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }),
  ]);
  expect(ledger[0].kind).toBe("source-preflight");
  expect((result as any).capture.writtenBytes).toBe(
    Buffer.byteLength(ledger.map(r => JSON.stringify(r) + "\n").join("")),
  );
  await expect(runSingleGuardedChatTurn(path, { conversation: { reviewFirst } })).rejects.toThrow();
  expect(m.turn).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});
it.each(["fail", "unscored"] as const)("stops at first human verdict %s", async verdict => {
  const path = setupPair();
  const result = await runSingleGuardedChatTurn(path, {
    conversation: { reviewFirst: async () => verdict },
  });
  expect(result).toMatchObject({ stopped: `first_quality_${verdict}` });
  expect(m.turn).toHaveBeenCalledOnce();
});
it("requires a new handler corpus observation on the second turn", async () => {
  const path = setupPair();
  const first = m.turn.getMockImplementation()!;
  m.turn.mockImplementationOnce(first).mockImplementationOnce(async (_i, _c, capture) => {
    capture.claim();
    m.guard.mock.calls[0][0].record("model-input", { prepared: { tools: [] } });
  });
  await expect(
    runSingleGuardedChatTurn(path, { conversation: { reviewFirst: async () => "pass" } }),
  ).rejects.toThrow("single_handler_corpus_observation_missing");
});
it.each(["disabled", "single", "code", "candidate"])(
  "rejects paired admission %s before source reads",
  async reason => {
    const path = setupPair(
      reason === "disabled"
        ? { enabled: false }
        : reason === "single"
          ? { conversation: undefined }
          : reason === "code"
            ? { files: {} }
            : {},
    );
    if (reason === "candidate") vi.stubEnv("CHAT_PAIR_EXPECTED_WEB_SHA", "c".repeat(40));
    await expect(
      runSingleGuardedChatTurn(path, { conversation: { reviewFirst: async () => "pass" } }),
    ).rejects.toThrow();
    expect(m.sources).not.toHaveBeenCalled();
    expect(m.gateway).not.toHaveBeenCalled();
  },
);

it.each(["truncate", "same-length-corruption"])(
  "refuses a %s private trace before follow-up dispatch",
  async failure => {
    const path = setupPair();
    await expect(
      runSingleGuardedChatTurn(path, {
        conversation: {
          reviewFirst: async () => {
            const trace = join(process.env.RUNNER_TEMP!, "chat-pair-123", "trace.jsonl");
            const old = readFileSync(trace, "utf8");
            writeFileSync(
              trace,
              failure === "truncate" ? "" : old.replace("Actual answer", "Forged answer"),
            );
            return "pass";
          },
        },
      }),
    ).rejects.toThrow("pair_trace_incomplete");
    expect(m.turn).toHaveBeenCalledOnce();
  },
);
it("does not return follow-up quality readiness with a truncated final artifact", async () => {
  const path = setupPair();
  const original = m.turn.getMockImplementation()!;
  m.turn.mockImplementation(async (...args) => {
    const result = await original(...args);
    if (m.turn.mock.calls.length === 2)
      writeFileSync(join(process.env.RUNNER_TEMP!, "chat-pair-123", "trace.jsonl"), "");
    return result;
  });
  await expect(
    runSingleGuardedChatTurn(path, { conversation: { reviewFirst: async () => "pass" } }),
  ).rejects.toThrow("pair_trace_incomplete");
});
