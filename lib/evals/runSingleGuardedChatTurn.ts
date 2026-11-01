import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { convertToModelMessages, gateway } from "ai";
import { z } from "zod";
import { MODEL_CHAT } from "@/lib/ai/const";
import { buildArtistChatInstructions } from "@/lib/chat/buildArtistChatInstructions";
import { loadResearchArtist } from "@/lib/questionResearch/loadResearchArtist";
import { loadPublicResearchOriginals } from "@/lib/questionResearch/loadPublicResearchOriginals";
import { getQuestionVisitorKey } from "@/lib/questionResearch/getQuestionVisitorKey";
import { loadChatPdfs } from "@/lib/chatPdf/loadChatPdfs";
import { chatStreamTurn } from "@/lib/evals/chatStreamTurn";
import { createGuardedChatExecution } from "@/lib/evals/createGuardedChatExecution";

/** One opt-in task in the existing Evals suite. No judge, source overrides or allowance bypass. */
export async function runSingleGuardedChatTurn(manifestPath: string) {
  const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
  const raw = readFileSync(manifestPath);
  if (
    !process.env.CHAT_SINGLE_MANIFEST_SHA256 ||
    hash(raw) !== process.env.CHAT_SINGLE_MANIFEST_SHA256
  )
    throw new Error("single_manifest_mismatch");
  const manifest = z
    .object({
      enabled: z.literal(true),
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
  if (!Object.keys(manifest.files).length) throw new Error("single_missing_code_pins");
  for (const [path, expected] of Object.entries(manifest.files)) {
    if (
      path.startsWith("/") ||
      path.split("/").includes("..") ||
      hash(readFileSync(path)) !== expected
    )
      throw new Error("single_code_pin_mismatch");
  }
  if (
    process.env.GITHUB_RUN_ATTEMPT !== "1" ||
    !process.env.GITHUB_RUN_ID ||
    !process.env.GITHUB_SHA ||
    process.env.GITHUB_SHA !== process.env.CHAT_SINGLE_EXPECTED_SHA
  )
    throw new Error("single_execution_identity_mismatch");
  for (const name of [
    "AI_GATEWAY_API_KEY",
    "TAVILY_API_KEY",
    "SUPABASE_DB_CONNECTION",
    "SUPABASE_URL",
    "MUSICNERD_RESEARCH_API_KEY",
    "BRAINTRUST_API_KEY",
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
    origin.hostname !== `${project}.supabase.co` ||
    hash(origin.origin) !== manifest.stagingOriginSha256 ||
    !(
      connection.hostname === `db.${project}.supabase.co` ||
      decodeURIComponent(connection.username).endsWith(`.${project}`)
    )
  )
    throw new Error("single_staging_target_mismatch");
  const actor = await loadResearchArtist(manifest.artistId);
  if (actor.name !== manifest.artistName) throw new Error("single_artist_mismatch");
  const instructions = buildArtistChatInstructions(actor.name);
  if (hash(JSON.stringify(instructions)) !== manifest.instructionsSha256)
    throw new Error("single_instructions_mismatch");
  await getQuestionVisitorKey(
    new Request("http://localhost/preflight", { headers: { "x-real-ip": "192.0.2.1" } }),
  );
  const originals = await loadPublicResearchOriginals(manifest.artistId);
  if (!originals.length || (await loadChatPdfs(manifest.artistId)).length)
    throw new Error("single_corpus_scope_mismatch");
  const directory = resolve(
    process.env.RUNNER_TEMP ?? ".",
    `chat-single-${process.env.GITHUB_RUN_ID}`,
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const operator = resolve(directory, "OPERATOR_CLAIM");
  const fd = openSync(operator, "wx", 0o600);
  writeFileSync(
    fd,
    JSON.stringify({ sha: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID }),
  );
  closeSync(fd);
  const records: { kind: string; value: unknown }[] = [];
  let bytes = 0;
  const record = (kind: string, value: unknown) => {
    const line = JSON.stringify({ kind, value }) + "\n";
    if (bytes + Buffer.byteLength(line) > 1000000) throw new Error("single_event_ledger_limit");
    appendFileSync(resolve(directory, "trace.jsonl"), line, { mode: 0o600 });
    bytes += Buffer.byteLength(line);
    records.push({ kind, value });
  };
  record(
    "source-preflight",
    originals.map(s => ({ sourceId: s.sourceId, revision: s.revision, textSha256: hash(s.text) })),
  );
  const prompt = await convertToModelMessages([
    { role: "user", parts: [{ type: "text", text: manifest.question }] },
  ]);
  const guardPath = resolve(directory, "guard.json");
  const guardRaw = JSON.stringify({
    version: 1,
    runId: `single-${process.env.GITHUB_RUN_ID}`,
    modelId: MODEL_CHAT,
    promptSha256: hash(JSON.stringify(prompt)),
    instructionsSha256: manifest.instructionsSha256,
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
    maxInputBytes: 32768,
    maxOutputTokens: 1024,
    maxOutputCharacters: 8192,
    maxCaptureBytes: 1000000,
  });
  writeFileSync(guardPath, guardRaw, { flag: "wx", mode: 0o600 });
  const execution = createGuardedChatExecution({
    manifestPath: guardPath,
    manifestSha256: hash(guardRaw),
    model: gateway(MODEL_CHAT),
    record: (kind, value) => {
      if (
        kind === "model-input" &&
        hash(JSON.stringify((value as { prepared: { tools: unknown } }).prepared.tools)) !==
          manifest.toolSchemasSha256
      )
        throw new Error("single_tool_schema_mismatch");
      record(kind, value);
    },
  });
  let admitted = false;
  const turn = await chatStreamTurn(
    { artistId: manifest.artistId, question: manifest.question },
    undefined,
    {
      requestId: `single-${process.env.GITHUB_RUN_ID}`,
      claim() {
        if (admitted) throw new Error("single_duplicate_admission");
        admitted = true;
      },
      record,
      signal: AbortSignal.timeout(150000),
    },
    execution,
  );
  // Returned only to the existing private Braintrust project, never public logs/artifacts.
  return {
    ...turn,
    diagnostic: {
      records,
      ledgerBytes: bytes,
      sha: process.env.GITHUB_SHA,
      reservationUsd: 0.65,
      invoiceGuarantee: false,
    },
  };
}
