import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomInt } from "node:crypto";
import { chunkInterviewEvidence } from "@/lib/interviewExperiment/chunkInterviewEvidence";
import type { ExperimentResult, InterviewCorpus } from "@/lib/interviewExperiment/types";

/** Write a private blind review and separate evidence/method files, without publishing data.
 * @param corpus - The exact corpus used for every arm.
 * @param results - Completed experiment arms.
 * @param directory - New local directory for review artifacts.
 * @returns The path to the blind question review.
 */
export async function writeInterviewReview(
  corpus: InterviewCorpus,
  results: ExperimentResult[],
  directory: string,
): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const shuffled = [...results];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sources = new Map(chunkInterviewEvidence(corpus.evidence).map(e => [e.id, e]));
  const review = [
    `# ${corpus.artist.name}: interview experiment`,
    "",
    "Private review. These are generated drafts, not questions sent to the artist.",
    "",
    "For each set: Would you ask these? Rate specificity, interest, naturalness and continuity from 1–5. Mark a preferred set before opening methods.json. Check premises in evidence.md.",
  ];
  const evidence = [
    `# ${corpus.artist.name}: evidence review`,
    "",
    "Model acceptance is advisory. Check full context in corpus.json, including attribution and corrections.",
  ];
  const methods = [];
  for (const [index, result] of shuffled.entries()) {
    const label = String.fromCharCode(65 + index);
    review.push("", `## Set ${label}`, "");
    if (!result.questions.length) review.push("No question passed the experiment checks.");
    for (const [i, q] of result.questions.entries()) {
      review.push(`${i + 1}. ${q.question}`);
      evidence.push(
        "",
        `## Set ${label}, question ${i + 1}`,
        q.question,
        "",
        `Why ask: ${q.whyAsk}`,
        `Unknown: ${q.unknown}`,
      );
      for (const support of q.evidence) {
        const source = sources.get(support.evidenceId);
        evidence.push(
          "",
          `Source: ${source?.url ?? source?.title ?? source?.group ?? support.evidenceId}`,
          `ID: ${support.evidenceId}; attribution: ${source?.attribution ?? "unknown"}; publication: ${source?.publishedAt ?? "unknown"}; available: ${source?.availableAt ?? "unknown"}`,
          "",
          ...support.quote.split("\n").map(line => `> ${line}`),
        );
      }
    }
    methods.push({
      set: label,
      arm: result.arm,
      model: result.model,
      corpusHash: result.corpusHash,
      asOf: result.asOf,
      calls: result.calls,
      selectedEvidence: result.evidenceIds.length,
      rejected: result.rejected.length,
      searches: result.searches,
    });
  }
  for (const [name, body] of [
    ["questions.md", review.join("\n") + "\n"],
    ["evidence.md", evidence.join("\n") + "\n"],
    ["methods.json", JSON.stringify(methods, null, 2)],
    ["results.json", JSON.stringify(results, null, 2)],
    ["corpus.json", JSON.stringify(corpus, null, 2)],
  ])
    await writeFile(join(directory, name), body, { mode: 0o600, flag: "wx" });
  return join(directory, "questions.md");
}
