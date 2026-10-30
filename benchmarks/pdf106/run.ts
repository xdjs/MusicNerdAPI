import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";
import { postArtistChatHandler } from "@/lib/chat/postArtistChatHandler";
import { MODEL_CHAT } from "@/lib/ai/const";
import { CASES, BASELINE } from "./cases";
import { preflight } from "./preflight";
import { reserveAttempt } from "./reserveAttempt";
import { sanitize } from "./sanitize";

// Only launched explicitly by the manual paired job, never by vitest or application code.
const cohort = process.env.PDF106_COHORT;
const dir = resolve(process.env.PDF106_OUTPUT ?? "");
if (!["baseline", "candidate"].includes(cohort ?? "") || !process.env.PDF106_OUTPUT)
  throw new Error("Explicit benchmark cohort/output required");
mkdirSync(dir, { recursive: true });
const secrets = Object.entries(process.env)
  .filter(([k]) => /KEY|TOKEN|SECRET|CONNECTION/.test(k))
  .map(([, v]) => v ?? "");
const save = (name: string, value: unknown) =>
  writeFileSync(join(dir, name), sanitize(JSON.stringify(value, null, 2), secrets));
const log = console.log.bind(console);
// Handler errors may carry provider request details; retain only generic failure markers.
console.error = () => log("[benchmark] application error (details withheld)");
console.warn = () => log("[benchmark] application warning (details withheld)");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if ((cohort === "baseline" && sha !== BASELINE) || MODEL_CHAT !== "anthropic/claude-sonnet-5.5")
  throw new Error("Baseline/model changed");
const numberTree = (v: unknown, depth = 0): unknown => {
  if (typeof v === "number") return v;
  if (!v || typeof v !== "object" || depth > 4) return undefined;
  return Object.fromEntries(
    Object.entries(v)
      .map(([k, x]) => [k, numberTree(x, depth + 1)])
      .filter(([, x]) => x !== undefined),
  );
};
if (existsSync(join(dir, "halted.json"))) {
  save(`${cohort}-blocked.json`, { reason: "Earlier cohort failed; no replacement submissions" });
  process.exit(0);
}
let snapshot: Awaited<ReturnType<typeof preflight>>;
try {
  snapshot = await preflight();
  save(`${cohort}-preflight.json`, { sha, ...snapshot });
  const previous = join(dir, "baseline-preflight.json");
  if (cohort === "candidate") {
    if (!existsSync(previous)) throw new Error("Baseline preflight missing");
    const baseline = JSON.parse(readFileSync(previous, "utf8"));
    if (
      JSON.stringify(baseline.corpus) !== JSON.stringify(snapshot.corpus) ||
      JSON.stringify(baseline.pdfs) !== JSON.stringify(snapshot.pdfs)
    )
      throw new Error("Public source snapshot changed between cohorts");
  }
} catch {
  save(`${cohort}-blocked.json`, {
    reason:
      "Staging identity, configuration or frozen public source preflight failed; no questions submitted by this cohort",
  });
  process.exit(1);
}
let halted = false;
questions: for (const c of CASES)
  for (const repetition of ["first", "repeated"]) {
    const id = `${cohort}:${c.key}:${repetition}`;
    if (halted || (c.key.startsWith("pdf") && !snapshot.pdfEligible)) {
      appendFileSync(
        join(dir, "results.jsonl"),
        JSON.stringify({
          id,
          submitted: false,
          reason: halted
            ? "Earlier error; stopped without replacement"
            : "Gold PDFs not currently eligible; no claim/source mutation",
        }) + "\n",
      );
      continue;
    }
    // Revalidate snapshots before each answer; preflight warms connections equally in both cohorts.
    let current;
    try {
      current = await preflight();
    } catch {
      save(`${cohort}-changed.json`, {
        reason: "Read-only source revalidation failed; remaining questions withheld",
      });
      break questions;
    }
    if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
      save(`${cohort}-changed.json`, {
        reason: "Public sources changed; remaining questions withheld",
      });
      break questions;
    }
    const count = reserveAttempt(join(dir, "attempts.json"), id);
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    const chunks: { ms: number; text: string }[] = [];
    const sources: { n: string; title: string; url: string }[] = [];
    const events: Record<string, unknown>[] = [];
    const observations: Promise<void>[] = [];
    (globalThis as unknown as { pdf106Observe: unknown }).pdf106Observe = (result: {
      fullStream: AsyncIterable<Record<string, unknown>>;
    }) => {
      observations.push(
        (async () => {
          for await (const part of result.fullStream) {
            if (
              [
                "start-step",
                "tool-call",
                "tool-result",
                "tool-error",
                "finish-step",
                "finish",
                "error",
              ].includes(String(part.type))
            ) {
              const event: Record<string, unknown> = {
                type: part.type,
                ms: Math.round(performance.now() - started),
              };
              if (typeof part.toolName === "string") event.tool = part.toolName;
              if (part.usage) event.usage = numberTree(part.usage);
              if (part.totalUsage) event.totalUsage = numberTree(part.totalUsage);
              const metadata = part.providerMetadata as Record<string, unknown> | undefined;
              if (metadata?.gateway) event.gatewayNumericMetadata = numberTree(metadata.gateway);
              if (part.type === "tool-result" && part.toolName === "readPdfSource") {
                const output = (part.output ?? part.result) as Record<string, unknown> | undefined;
                if (output)
                  event.pdf = {
                    n: output.n,
                    pages: output.pages,
                    sha256: output.sha256,
                    failed: Boolean(output.error),
                  };
              }
              events.push(event);
            }
          }
        })().catch(() => {
          events.push({ type: "observer-error" });
        }),
      );
    };
    let status = 0;
    let error: string | undefined;
    try {
      const response = await postArtistChatHandler(
        new Request(`http://localhost/api/artist/${c.artistId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "192.0.2.1" },
          body: JSON.stringify({
            messages: [{ id: "eval", role: "user", parts: [{ type: "text", text: c.question }] }],
          }),
          signal: controller.signal,
        }),
        c.artistId,
      );
      status = response.status;
      if (!response.ok || !response.body) throw new Error("Handler rejected request");
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
          const part = JSON.parse(line.slice(6));
          if (part.type === "text-delta")
            chunks.push({ ms: Math.round(performance.now() - started), text: part.delta });
          if (part.type === "source-url")
            sources.push({ n: part.sourceId, title: part.title ?? "", url: part.url });
          if (part.type === "error") error = "Stream error; details withheld";
        }
      }
      await Promise.all(observations);
    } catch {
      error = controller.signal.aborted ? "Timeout" : "Handler or stream failed";
    } finally {
      clearTimeout(timeout);
    }
    const record = {
      id,
      submitted: true,
      count,
      sha,
      model: MODEL_CHAT,
      question: c.question,
      status,
      error,
      firstDeltaMs: chunks[0]?.ms ?? null,
      totalMs: Math.round(performance.now() - started),
      answer: chunks.map(x => x.text).join(""),
      chunks,
      sources,
      events,
      firstSubstantiveMs: "manual review of timestamped text required",
      cacheState: "unknown unless usage records establish it",
    };
    appendFileSync(join(dir, "results.jsonl"), sanitize(JSON.stringify(record), secrets) + "\n");
    log(`[benchmark] ${id} submission=${count} status=${status} complete=${record.totalMs}ms`);
    if (error || events.some(e => e.type === "error")) {
      halted = true;
      save("halted.json", { id, reason: "Handler or model error; remaining calls withheld" });
    }
  }
process.exit(0);
