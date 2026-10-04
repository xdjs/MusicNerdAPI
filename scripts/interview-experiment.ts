import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { captureInterviewCorpus } from "@/lib/interviewExperiment/captureInterviewCorpus";
import { runInterviewExperiment } from "@/lib/interviewExperiment/runInterviewExperiment";
import { writeInterviewReview } from "@/lib/interviewExperiment/writeInterviewReview";
import type {
  ExperimentArm,
  ExperimentResult,
  InterviewCorpus,
} from "@/lib/interviewExperiment/types";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    "env-file": { type: "string" },
    "artist-id": { type: "string" },
    "expected-handle": { type: "string" },
    environment: { type: "string" },
    corpus: { type: "string" },
    output: { type: "string" },
    "as-of": { type: "string" },
    model: { type: "string" },
    "exclude-source": { type: "string", multiple: true },
    "exclusion-reason": { type: "string" },
    arm: { type: "string" },
    help: { type: "boolean" },
  },
});
if (values["env-file"]) process.loadEnvFile(resolve(values["env-file"]));
const main = async () => {
  if (values.help) {
    console.log(
      "pnpm interview:experiment snapshot --env-file <private-env> --environment production|staging --artist-id <uuid> --expected-handle <handle> --output <private-corpus.json>\npnpm interview:experiment run --env-file <preview-env> --corpus <private-corpus.json> --output <new-private-directory> [--as-of <ISO-date>] [--exclude-source <id> --exclusion-reason <reason>] [--arm signals|context|connections]",
    );
    return;
  }
  if (!values.output) throw new Error("--output is required");
  if (positionals[0] === "snapshot") {
    if (
      !values["artist-id"] ||
      !values["expected-handle"] ||
      !["production", "staging"].includes(values.environment ?? "")
    )
      throw new Error("Explicit artist id, handle and environment are required");
    if (!process.env.SUPABASE_DB_CONNECTION) throw new Error("SUPABASE_DB_CONNECTION is missing");
    const corpus = await captureInterviewCorpus(
      values["artist-id"],
      values["expected-handle"],
      process.env.SUPABASE_DB_CONNECTION,
      values.environment as "production" | "staging",
    );
    await writeFile(resolve(values.output), JSON.stringify(corpus, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    console.log(
      JSON.stringify({
        artist: corpus.artist.name,
        environment: corpus.environment,
        evidence: corpus.evidence.length,
        capturedAt: corpus.capturedAt,
      }),
    );
    return;
  }
  if (positionals[0] !== "run" || !values.corpus)
    throw new Error("Use snapshot or run; see --help");
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN)
    throw new Error("AI Gateway credentials are required");
  const corpus = JSON.parse(await readFile(resolve(values.corpus), "utf8")) as InterviewCorpus;
  if (corpus.version !== 1 || !Array.isArray(corpus.evidence) || !corpus.artist?.id)
    throw new Error("Invalid version-1 corpus");
  const excluded = new Set(values["exclude-source"] ?? []);
  if (excluded.size) {
    if (!values["exclusion-reason"]) throw new Error("An exclusion reason is required");
    const removed = corpus.evidence.filter(e => excluded.has(e.id));
    if (removed.length !== excluded.size)
      throw new Error("An excluded evidence id was not in the snapshot");
    corpus.exclusions = removed.map(e => ({ id: e.id, reason: values["exclusion-reason"]! }));
    corpus.evidence = corpus.evidence.filter(e => !excluded.has(e.id));
  }
  const arms: ExperimentArm[] = values.arm
    ? [values.arm as ExperimentArm]
    : ["signals", "context", "connections"];
  if (arms.some(a => !["signals", "context", "connections"].includes(a)))
    throw new Error("Unknown experiment arm");
  const results: ExperimentResult[] = [];
  const directory = resolve(values.output);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  for (const arm of arms) {
    const result = await runInterviewExperiment(corpus, arm, {
      asOf: values["as-of"],
      model: values.model,
    });
    results.push(result);
    await writeFile(join(directory, `${arm}.json`), JSON.stringify(result, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    console.log(
      JSON.stringify({
        artist: corpus.artist.name,
        arm,
        questions: result.questions.length,
        rejected: result.rejected.length,
        calls: result.calls,
      }),
    );
  }
  console.log(await writeInterviewReview(corpus, results, directory));
};
main().catch(error => {
  console.error(
    error instanceof Error ? `${error.name}: ${error.message.slice(0, 350)}` : "Experiment failed",
  );
  process.exitCode = 1;
});
