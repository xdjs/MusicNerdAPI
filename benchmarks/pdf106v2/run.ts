import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
  openSync,
  closeSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
import { sanitize } from "../pdf106/sanitize";
import { runtime, setupFixture, ARTIST, DOCUMENTS, setFixtureDirectory } from "./runtime";
import { ledger } from "./ledger";
import { boundedFetch } from "./network";
// Only the explicitly approved, fixed four-answer workflow invokes this runner.
const args = process.argv.slice(2);
const option = (k: string) => args[args.indexOf(k) + 1];
if (
  !args.includes("--approved-four-paired") ||
  !args.includes("--output") ||
  !args.includes("--fixtures") ||
  !args.includes("--cohort") ||
  !args.includes("--case")
)
  throw Error("Explicit approved four-answer comparison/output/fixtures/cohort/case required");
const cohort = option("--cohort");
const selectedCase = option("--case");
const pins = {
  baseline: "277e8ebadb9c55c10a11f2d774afafa9a8c276d8",
  candidate: "4fa7c2f02030a17256452fde4508548b2f793e43",
};
if (!(cohort in pins)) throw Error("Unknown cohort");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (sha !== pins[cohort as keyof typeof pins]) throw Error("Application pin changed");
setFixtureDirectory(resolve(option("--fixtures")));
const pdfCases = JSON.parse(readFileSync("benchmarks/pdf106v2/fixtures/cases.json", "utf8")) as {
  key: string;
  question: string;
  doc: string;
  extracted: boolean;
}[];
const cases = pdfCases.slice(0, 2);
if (
  cases.length !== 2 ||
  cases.map(c => c.key).join(",") !== "pdf-alias,pdf-qualified-preservation"
)
  throw Error("Expected exactly two frozen PDF questions");
const order = [
  "baseline:pdf-alias:once",
  "candidate:pdf-alias:once",
  "candidate:pdf-qualified-preservation:once",
  "baseline:pdf-qualified-preservation:once",
];
const selected = cases.find(c => c.key === selectedCase);
if (!selected) throw Error("Unknown question");
const selectedId = `${cohort}:${selectedCase}:once`;
const manifest = {
  version: 4,
  pins,
  cases,
  documents: DOCUMENTS,
  cap: 2048,
  answers: 4,
  order,
  stepsPerAnswer: 6,
  modelEgress: 24,
  webEgress: 0,
};
const manifestHash = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
const dir = resolve(option("--output"));
mkdirSync(dir, { recursive: true });
// Retain each exclusive case marker: a crash/unknown outcome cannot be rerun.
const lock = openSync(join(dir, `${cohort}-${selectedCase}.started`), "wx", 0o600);
closeSync(lock);
const budget = ledger(join(dir, "ledger.json"), manifestHash);
if (budget.read().halted || order[budget.read().attempts.length] !== selectedId)
  throw Error("Run halted or order mismatch");
const secrets = Object.entries(process.env)
  .filter(([k]) => /KEY|TOKEN|SECRET|CONNECTION/.test(k))
  .map(([, v]) => v ?? "");
const save = (name: string, x: unknown) =>
  writeFileSync(join(dir, name), sanitize(JSON.stringify(x, null, 2), secrets));
save("manifest.json", manifest);
const originalFetch = globalThis.fetch;
console.error = () => console.log("[eval] application error withheld");
console.warn = () => console.log("[eval] warning withheld");
// Existing originals are hash-verified locally by setupFixture before each counted answer.
// Answer execution uses isolated source and allowance rows on both application pins.
globalThis.fetch = boundedFetch(originalFetch, budget);
try {
  for (const c of [selected])
    for (const repetition of ["once"]) {
      const id = `${cohort}:${c.key}:${repetition}`;
      if (budget.read().halted) break;
      const fixture = c.doc ? await setupFixture(c.extracted) : undefined;
      runtime.allowedDoc = c.doc ?? undefined;
      const count = budget.reserve(id);
      const start = performance.now();
      runtime.startedAt = start;
      runtime.transport = [];
      const controller = new AbortController();
      const chunks: { ms: number; text: string }[] = [];
      const sources: unknown[] = [];
      const events: Record<string, unknown>[] = [];
      const observations: Promise<void>[] = [];
      runtime.observe = (value: unknown) => {
        const result = value as { fullStream: AsyncIterable<Record<string, unknown>> };
        observations.push(
          (async () => {
            for await (const e of result.fullStream) {
              const event: Record<string, unknown> = {
                type: e.type,
                ms: Math.round(performance.now() - start),
              };
              if (e.toolName) event.tool = e.toolName;
              if (e.type === "finish-step") event.usage = e.usage;
              if (e.type === "finish") event.totalUsage = e.totalUsage;
              if (
                e.type === "tool-result" &&
                (e.toolName === "readPdfSource" || e.toolName === "readNamedPdf")
              ) {
                const o = (e.output ?? e.result) as Record<string, unknown>;
                event.pdf = {
                  sourceId: o?.sourceId,
                  n: o?.n,
                  pages: o?.pages,
                  sha256: o?.sha256,
                  error: !!o?.error,
                };
              }
              if (
                [
                  "text-delta",
                  "tool-call",
                  "tool-result",
                  "tool-error",
                  "finish-step",
                  "finish",
                  "error",
                ].includes(String(e.type))
              )
                events.push(event);
            }
          })().catch(() => {
            events.push({ type: "observer-error" });
          }),
        );
      };
      let status = 0;
      let failure: string | undefined;
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          (async () => {
            const artist = c.doc ? ARTIST : "aab92f80-f9e1-4299-aa33-7dd85c8de5d3";
            const response = await postArtistChatHandler(
              new Request(`http://localhost/api/artist/${artist}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.1" },
                body: JSON.stringify({
                  messages: [
                    { id: "q", role: "user", parts: [{ type: "text", text: c.question }] },
                  ],
                }),
                signal: controller.signal,
              }),
              artist,
            );
            status = response.status;
            if (!response.ok || !response.body) throw Error("Handler rejected");
            const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
            let buffer = "";
            for (;;) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += value;
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
                const p = JSON.parse(line.slice(6));
                if (p.type === "text-delta")
                  chunks.push({ ms: Math.round(performance.now() - start), text: p.delta });
                if (p.type === "source-url")
                  sources.push({ n: p.sourceId, title: p.title, url: p.url });
                if (p.type === "error") failure = "Stream error";
              }
            }
            await Promise.all(observations);
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(Error("Timeout"));
            }, 120000);
          }),
        ]);
      } catch {
        failure = controller.signal.aborted
          ? "Timeout; outcome counted, no retry"
          : "Handler/observer failure";
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (
        events.some(
          e => e.type === "error" || e.type === "tool-error" || e.type === "observer-error",
        )
      )
        failure ??= "Model/tool error";
      if (budget.read().halted) failure ??= "Egress guard stopped run";
      const expected = c.doc ? DOCUMENTS.find(d => d.id === c.doc) : undefined;
      if (c.doc && runtime.fixtureReads.some(p => !p.includes(c.doc!)))
        failure ??= "Unrelated PDF read";
      const record = {
        id,
        count,
        sha,
        submitted: true,
        status,
        failure,
        question: c.question,
        boundary: c.doc
          ? "isolated source rows and storage; actual handler/SQL/tools/SDK"
          : "real staging public source/allowance",
        doc: expected,
        extractedTextVariant: c.doc ? (c.extracted ? "present" : "null") : undefined,
        answer: chunks.map(c => c.text).join(""),
        chunks,
        sources,
        events,
        fixtureReads: [...runtime.fixtureReads],
        syntheticWebAttempts: runtime.syntheticWebAttempts,
        transport: runtime.transport,
        completeMs: Math.round(performance.now() - start),
        maxOutputTokens: 2048,
        firstSubstantiveMs: "manual passage-level timing review required",
        providerCache: "inspect usage; repetition does not imply warm cache",
      };
      appendFileSync(join(dir, "results.jsonl"), sanitize(JSON.stringify(record), secrets) + "\n");
      budget.finish(id, !!failure, failure);
      runtime.observe = undefined;
      runtime.allowedDoc = undefined;
      if (fixture) await fixture.close();
      console.log(`[eval-v2] ${id} submitted=${count} status=${status} failed=${!!failure}`);
      if (failure) break;
    }
} finally {
  runtime.observe = undefined;
  globalThis.fetch = originalFetch;
}
const submitted = new Set(budget.read().attempts.map(a => a.id));
save("coverage.json", {
  planned: 4,
  submitted: submitted.size,
  unrun: order.filter(id => !submitted.has(id)),
  halted: budget.read().halted,
});
process.exit(budget.read().halted ? 1 : 0);
