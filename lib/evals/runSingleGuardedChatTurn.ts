import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { convertToModelMessages, gateway } from "ai";
import { z } from "zod";
import { runGuardedChatConversation } from "@/lib/evals/runGuardedChatConversation";
import { MODEL_CHAT } from "@/lib/ai/const";
import { createBoundedChatCapture } from "@/lib/evals/createBoundedChatCapture";
import { getChatCorpusFingerprint } from "@/lib/chat/getChatCorpusFingerprint";
import { pdfEvalSchema } from "@/lib/evals/pdfEvalTypes";
import { createGuardedChatExecution } from "@/lib/evals/createGuardedChatExecution";

/** One opt-in task in the existing Evals suite. No judge, source overrides or allowance bypass. */
export async function runSingleGuardedChatTurn(
  manifestPath: string,
  options: {
    preflightOnly?: boolean;
    conversation?: { reviewFirst: Parameters<typeof runGuardedChatConversation>[0]["reviewFirst"] };
  } = {},
) {
  const preflightStarted = performance.now();
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const raw = readFileSync(manifestPath);
  const paired = options.conversation !== undefined;
  const manifestPin = paired
    ? process.env.CHAT_PAIR_MANIFEST_SHA256
    : process.env.CHAT_SINGLE_MANIFEST_SHA256;
  if (!manifestPin || hash(raw) !== manifestPin) throw new Error("single_manifest_mismatch");
  const manifest = z
    .object({
      version: z.literal(2),
      conversation: z
        .object({
          apiSha: z.string().regex(/^[a-f0-9]{40}$/),
          webSha: z.string().regex(/^[a-f0-9]{40}$/),
          model: z.literal(MODEL_CHAT),
          followUp: z.string().trim().min(1).max(500),
          maxTurns: z.literal(2),
          maxDurationMs: z.literal(300000),
          firstQualityGate: z.literal("human"),
        })
        .strict()
        .optional(),
      provider: z.enum(["anthropic", "vertex"]),
      enabled: z.boolean(),
      utcDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      attributedTextCharacters: z.literal(12000),
      corpusSha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      promptSha256: z.string().regex(/^[a-f0-9]{64}$/),
      pdf: z
        .object({
          execution: z
            .object({
              maxCalls: z.literal(6),
              maxToolExecutions: z.literal(8),
              maxWebSearches: z.literal(1),
              maxInputBytes: z.literal(262144),
              maxTotalInputBytes: z.literal(1048576),
              maxCaptureBytes: z.literal(4194304),
            })
            .strict(),
          admission: pdfEvalSchema.refine(
            p => p.documents.every(d => d.url === undefined),
            "Publish URL hashes, not database origins",
          ),
          urlSha256: z.record(z.uuid(), z.string().regex(/^[a-f0-9]{64}$/)),
          reservationUsd: z.number().positive().max(100),
        })
        .strict()
        .optional(),
      artistId: z.uuid(),
      artistName: z.string().min(1),
      question: z.string().min(1).max(500),
      stagingOriginSha256: z.string().regex(/^[a-f0-9]{64}$/),
      instructionsSha256: z.string().regex(/^[a-f0-9]{64}$/),
      toolSchemasSha256: z.string().regex(/^[a-f0-9]{64}$/),
      files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    })
    .strict()
    .parse(JSON.parse(raw.toString()));
  if (paired !== !!manifest.conversation) throw new Error("pair_mode_mismatch");
  if (paired) {
    if (typeof options.conversation?.reviewFirst !== "function")
      throw new Error("pair_human_review_required");
    if (
      manifest.conversation!.apiSha !== process.env.GITHUB_SHA ||
      manifest.conversation!.webSha !== process.env.CHAT_PAIR_EXPECTED_WEB_SHA
    )
      throw new Error("pair_candidate_mismatch");
    if (!manifest.pdf || manifest.provider !== "anthropic") throw new Error("pair_scope_mismatch");
    // Require the complete runtime source tree, not a caller-selected subset of pins.
    const runtimePaths = ["lib", "app"].flatMap(root =>
      readdirSync(root, { recursive: true, withFileTypes: true })
        .filter(
          entry =>
            entry.isFile() &&
            /\.tsx?$/.test(entry.name) &&
            !entry.name.includes(".test.") &&
            !entry.parentPath.split("/").includes("__tests__"),
        )
        .map(entry => `${entry.parentPath}/${entry.name}`),
    );
    for (const path of [
      ...runtimePaths,
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
    ])
      if (!manifest.files[path]) throw new Error("pair_required_code_pin_missing");
  }
  if (manifest.utcDate !== new Date().toISOString().slice(0, 10))
    throw new Error("single_date_pin_mismatch");
  if (!options.preflightOnly && !manifest.enabled) throw new Error("single_manifest_disabled");
  if (!options.preflightOnly && !manifest.corpusSha256)
    throw new Error("single_corpus_pin_missing");
  if (!Object.keys(manifest.files).length) throw new Error("single_missing_code_pins");
  for (const [path, expected] of Object.entries(manifest.files)) {
    if (
      path.startsWith("/") ||
      path.split("/").includes("..") ||
      !/^(?:lib\/|app\/|evals\/|\.github\/workflows\/|package\.json$|pnpm-lock\.yaml$|tsconfig\.json$)/.test(
        path,
      ) ||
      path.split("/").some(part => part.startsWith(".env")) ||
      hash(readFileSync(path)) !== expected
    )
      throw new Error("single_code_pin_mismatch");
  }
  if (
    process.env.GITHUB_RUN_ATTEMPT !== "1" ||
    !process.env.GITHUB_RUN_ID ||
    !process.env.GITHUB_SHA ||
    process.env.GITHUB_SHA !==
      (paired ? process.env.CHAT_PAIR_EXPECTED_SHA : process.env.CHAT_SINGLE_EXPECTED_SHA)
  )
    throw new Error("single_execution_identity_mismatch");
  for (const name of [
    "AI_GATEWAY_API_KEY",
    "TAVILY_API_KEY",
    "SUPABASE_DB_CONNECTION",
    "SUPABASE_URL",
    "MUSICNERD_RESEARCH_API_KEY",
    ...(paired ? [] : ["BRAINTRUST_API_KEY"]),
  ])
    if (!process.env[name]) throw new Error("single_runtime_configuration_missing");
  let origin: URL;
  let connection: URL;
  try {
    origin = new URL(process.env.SUPABASE_URL!);
    connection = new URL(process.env.SUPABASE_DB_CONNECTION!);
  } catch {
    throw new Error("single_runtime_url_invalid");
  }
  const project = origin.hostname.split(".")[0];
  if (
    origin.protocol !== "https:" ||
    !!origin.username ||
    !!origin.password ||
    !!origin.port ||
    origin.pathname !== "/" ||
    !!origin.search ||
    !!origin.hash ||
    !/^[a-z0-9]{20}$/.test(project) ||
    origin.hostname !== `${project}.supabase.co` ||
    hash(origin.origin) !== manifest.stagingOriginSha256 ||
    !["postgres:", "postgresql:"].includes(connection.protocol) ||
    !(
      connection.hostname === `db.${project}.supabase.co` ||
      (/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(connection.hostname) &&
        decodeURIComponent(connection.username).endsWith(`.${project}`))
    )
  )
    throw new Error("single_staging_target_mismatch");
  // Validate target/config before importing lazy DB boundaries; invalid URL
  // inputs must never escape through dependency initialization errors.
  const { loadResearchArtist } = await import("@/lib/questionResearch/loadResearchArtist");
  const { loadPublicResearchOriginals } =
    await import("@/lib/questionResearch/loadPublicResearchOriginals");
  const { getQuestionVisitorKey } = await import("@/lib/questionResearch/getQuestionVisitorKey");
  const { loadChatPdfs } = await import("@/lib/chatPdf/loadChatPdfs");
  const actor = await loadResearchArtist(manifest.artistId);
  if (actor.name !== manifest.artistName) throw new Error("single_artist_mismatch");
  await getQuestionVisitorKey(
    new Request("http://localhost/preflight", { headers: { "x-real-ip": "192.0.2.1" } }),
  );
  const originals = await loadPublicResearchOriginals(manifest.artistId);
  const pdfs = await loadChatPdfs(manifest.artistId);
  if (manifest.pdf) {
    // Full eligible corpus, not a silently filtered subset or preselected document.
    if (
      pdfs.length !== manifest.pdf.admission.documents.length ||
      manifest.pdf.admission.documents.some(
        pin =>
          !pdfs.some(
            source =>
              source.id === pin.sourceId &&
              source.revision === pin.revision &&
              source.title === pin.filename &&
              source.size === pin.bytes &&
              hash(source.url) === manifest.pdf!.urlSha256[pin.sourceId],
          ),
      )
    )
      throw new Error("single_pdf_corpus_mismatch");
  } else if (!originals.length || pdfs.length) {
    throw new Error("single_corpus_scope_mismatch");
  }
  if (manifest.pdf) {
    const { readChatPdf } = await import("@/lib/chatPdf/readChatPdf");
    // Read-only local validation of every eligible original before ANY paid call.
    // Do not cache/substitute these bytes into the later autonomous tool reads.
    for (const pin of manifest.pdf.admission.documents) {
      const source = pdfs.find(source => source.id === pin.sourceId)!;
      const file = await readChatPdf(source, AbortSignal.timeout(3000));
      if (file.hash !== pin.sha256 || file.pages !== pin.pages || file.bytes.length !== pin.bytes)
        throw new Error("single_pdf_original_mismatch");
    }
  }
  const corpusSha256 = getChatCorpusFingerprint(originals);
  const preflight = {
    ready: !!manifest.corpusSha256 && corpusSha256 === manifest.corpusSha256,
    corpusSha256,
    sourceCount: originals.length,
    pdfCount: pdfs.length,
    model: MODEL_CHAT,
    provider: manifest.provider,
    utcDate: manifest.utcDate,
    candidateSha: process.env.GITHUB_SHA!,
    preflightMs: Math.round(performance.now() - preflightStarted),
  };
  // This branch performs only ordinary reads and visitor/config validation. No model,
  // allowance reservation, operator claim, trace destination or experiment creation.
  if (options.preflightOnly) return { preflight };
  if (!preflight.ready) throw new Error("single_source_corpus_mismatch");
  const pdfSnapshot = new Map(pdfs.map(source => [source.id, { ...source }]));
  const pdfAdmission = manifest.pdf
    ? {
        ...manifest.pdf.admission,
        documents: manifest.pdf.admission.documents.map(document => ({
          ...document,
          url: pdfSnapshot.get(document.sourceId)!.url,
        })),
      }
    : undefined;
  const directory = resolve(
    process.env.RUNNER_TEMP ?? ".",
    `chat-${paired ? "pair" : "single"}-${process.env.GITHUB_RUN_ID}`,
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const operator = resolve(directory, "OPERATOR_CLAIM");
  const fd = openSync(operator, "wx", 0o600);
  writeFileSync(
    fd,
    JSON.stringify({ sha: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID }),
  );
  closeSync(fd);
  const tracePath = resolve(directory, "trace.jsonl");
  const traceFd = openSync(tracePath, "wx", 0o600);
  closeSync(traceFd);
  const ledgerHash = createHash("sha256");
  const capture = createBoundedChatCapture({
    maxBytes: manifest.pdf?.execution.maxCaptureBytes ?? 1000000,
    write: line => {
      appendFileSync(tracePath, line);
      ledgerHash.update(line);
    },
  });
  let actualCorpusValidated = false;
  const observe = (kind: string, value: unknown) => {
    if (
      kind === "server-tool-event" &&
      (value as { type?: string })?.type === "data-chat-corpus-pin"
    ) {
      if ((value as { data?: { sha256?: string } }).data?.sha256 !== manifest.corpusSha256)
        throw new Error("single_handler_corpus_mismatch");
      actualCorpusValidated = true;
    }
  };
  const record = (kind: string, value: unknown) => {
    observe(kind, value);
    capture.record(kind, value);
  };
  record(
    "source-preflight",
    originals.map(s => ({ sourceId: s.sourceId, revision: s.revision, textSha256: hash(s.text) })),
  );
  if (manifest.pdf)
    record("pdf-preflight", {
      documents: manifest.pdf.admission.documents,
      binaryCapture: "verified-reference-only",
      reservationUsd: manifest.pdf.reservationUsd,
      invoiceGuarantee: false,
    });
  const prompt = await convertToModelMessages([
    { role: "user", parts: [{ type: "text", text: manifest.question }] },
  ]);
  if (hash(JSON.stringify(prompt)) !== manifest.promptSha256)
    throw new Error("single_prompt_mismatch");
  const guardPath = resolve(directory, "guard.json");
  const guardRaw = JSON.stringify({
    version: 1,
    ...(pdfAdmission ? { pdf: pdfAdmission } : {}),
    runId: `${paired ? "pair" : "single"}-${process.env.GITHUB_RUN_ID}`,
    modelId: MODEL_CHAT,
    promptSha256: manifest.promptSha256,
    provider: manifest.provider,
    instructionsSha256: manifest.instructionsSha256,
    toolLimits: {
      searchSources: 6,
      readSource: 6,
      webSearch: manifest.pdf?.execution.maxWebSearches ?? 2,
      searchPdfSources: 6,
      readPdfSource: 2,
      readNamedPdf: 2,
    },
    maxToolExecutions: manifest.pdf?.execution.maxToolExecutions ?? 12,
    maxCalls: manifest.pdf?.execution.maxCalls ?? 6,
    maxInputBytes: manifest.pdf?.execution.maxInputBytes ?? 128000,
    maxTotalInputBytes: manifest.pdf?.execution.maxTotalInputBytes ?? 196608,
    maxOutputTokens: 1024,
    maxOutputCharacters: 8192,
    maxCaptureBytes: manifest.pdf?.execution.maxCaptureBytes ?? 1000000,
  });
  writeFileSync(guardPath, guardRaw, { flag: "wx", mode: 0o600 });
  const createExecution = (
    controls?: Parameters<Parameters<typeof runGuardedChatConversation>[0]["createExecution"]>[0],
  ) =>
    createGuardedChatExecution({
      ...(controls ? { continuation: controls.continuation } : {}),
      manifestPath: guardPath,
      manifestSha256: hash(guardRaw),
      model: gateway(MODEL_CHAT),
      ...(manifest.pdf
        ? {
            validatePdfCatalog: async () => {
              if (
                getChatCorpusFingerprint(await loadChatPdfs(manifest.artistId)) !==
                getChatCorpusFingerprint(pdfs)
              )
                throw new Error("single_pdf_catalog_changed");
            },
            validatePdfSource: async (pin: (typeof manifest.pdf.admission.documents)[number]) => {
              const baseline = pdfSnapshot.get(pin.sourceId);
              const current = await loadChatPdfs(manifest.artistId, pin.sourceId);
              if (
                !baseline ||
                current.length !== 1 ||
                current[0].id !== pin.sourceId ||
                current[0].revision !== pin.revision ||
                current[0].title !== pin.filename ||
                current[0].size !== pin.bytes ||
                current[0].path !== baseline.path ||
                current[0].url !== baseline.url ||
                current[0].claimId !== baseline.claimId
              )
                throw new Error("single_pdf_source_changed");
            },
          }
        : {}),
      record: (kind, value) => {
        if (kind === "model-input" && !actualCorpusValidated)
          throw new Error("single_handler_corpus_observation_missing");
        if (
          kind === "model-input" &&
          hash(JSON.stringify((value as { prepared: { tools: unknown } }).prepared.tools)) !==
            manifest.toolSchemasSha256
        )
          throw new Error("single_tool_schema_mismatch");
        (controls?.record ?? record)(kind, value);
      },
    });
  if (paired && manifest.conversation && options.conversation) {
    const verifyTrace = () => {
      try {
        const bytes = readFileSync(tracePath);
        if (
          bytes.length !== capture.snapshot().writtenBytes ||
          hash(bytes) !== ledgerHash.copy().digest("hex")
        )
          throw new Error("mismatch");
        for (const line of bytes.toString("utf8").trim().split("\n")) JSON.parse(line);
      } catch {
        throw new Error("pair_trace_incomplete");
      }
    };
    const reviewFirst = options.conversation.reviewFirst;
    const result = await runGuardedChatConversation({
      artistId: manifest.artistId,
      question: manifest.question,
      followUp: manifest.conversation.followUp,
      requestId: `pair-${process.env.GITHUB_RUN_ID}`,
      maxCaptureBytes: manifest.pdf!.execution.maxCaptureBytes,
      createExecution,
      capture,
      observe,
      beforeTurn: () => {
        actualCorpusValidated = false;
      },
      write: line => {
        appendFileSync(tracePath, line);
      },
      reviewFirst: async (...args) => {
        verifyTrace();
        const verdict = await reviewFirst(...args);
        verifyTrace();
        return verdict;
      },
    });
    verifyTrace();
    return {
      ...result,
      diagnostic: {
        preflight,
        tracePath,
        capture: capture.snapshot(),
        invoiceGuarantee: false,
        reservationUsd: manifest.pdf!.reservationUsd,
      },
    };
  }
  const execution = createExecution();
  let admitted = false;
  const { chatStreamTurn } = await import("@/lib/evals/chatStreamTurn");
  const turn = await chatStreamTurn(
    {
      artistId: manifest.artistId,
      question: manifest.question,
      attributedTextCharacters: manifest.attributedTextCharacters,
    },
    undefined,
    {
      requestId: `single-${process.env.GITHUB_RUN_ID}`,
      claim() {
        if (admitted) throw new Error("single_duplicate_admission");
        admitted = true;
      },
      record,
      signal: AbortSignal.any([AbortSignal.timeout(150000), capture.signal]),
    },
    execution,
  );
  let records: { kind: string; value: unknown }[] = [];
  let traceReadable = true;
  try {
    records = readFileSync(tracePath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch {
    // Preserve the private uncertain-write file unchanged. Never repair a prefix
    // into complete evidence or lose the bounded safe failure receipt.
    traceReadable = false;
    turn.error = "single_trace_unreadable";
    turn.evidenceCaptureComplete = false;
    if (turn.capture) turn.capture.complete = false;
  }
  // Returned only to the existing private Braintrust project, never public logs/artifacts.
  return {
    ...turn,
    firstTextMs: turn.answer.trim().length ? turn.firstTextMs : null,
    diagnostic: {
      records,
      traceReadable,
      capture: capture.snapshot(),
      preflight,
      ledgerBytes: capture.snapshot().writtenBytes,
      sha: process.env.GITHUB_SHA,
      reservationUsd: manifest.pdf?.reservationUsd ?? 0.65,
      invoiceGuarantee: false,
    },
  };
}
