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
  for (const source of corpus.evidence) sources.set(source.id, source);
  for (const result of results)
    for (const source of result.preparation?.context ?? result.grounding?.context ?? [])
      sources.set(source.id, source);
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
    const conversation = result.preparation?.conversation ?? result.grounding?.conversation;
    if (conversation)
      review.push(
        `Exercise: ${conversation.kind} replay; not a newly received artist answer.`,
        "",
        ...conversation.turns.map(t => `${t.speaker}: ${t.text}`),
        "",
      );
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
      ...(result.grounding
        ? {
            reviewModel: result.grounding.reviewModel,
            preparationModel: result.grounding.research.model,
            preparationCall: result.grounding.research.call,
            preparationReused: true,
          }
        : {}),
      corpusHash: result.corpusHash,
      asOf: result.asOf,
      calls: result.calls,
      selectedEvidence: result.evidenceIds.length,
      rejected: result.rejected.length,
      searches: result.searches,
    });
  }
  for (const result of results) {
    if (result.grounding) {
      const { research, reviewModel, attempts } = result.grounding;
      const report = [
        `# ${corpus.artist.name}: complete archive preparation`,
        "",
        `Assignment: ${research.purpose}`,
        "",
        `Submitted text: ${research.sourceIds.length} eligible sources; ${research.characters} extracted characters. This is coverage, not proof of comprehension or complete PDF extraction.`,
        `Preparation reused: ${research.promptVersion}; corpus ${research.corpusHash}; cutoff ${research.asOf}.`,
        `Preparation model: ${research.model}; writer: ${result.model}; reviewer: ${reviewModel}.`,
        "",
        "Originals remain authoritative. Full reviewer verdicts and both drafting attempts are preserved in results.json.",
        "",
        "## Ledger",
        "",
        ...research.notes.flatMap((n, i) => [
          `### ${i}: ${n.status} — ${n.timeScope}`,
          "",
          n.statement,
          "",
          ...n.evidence.map(e => `- ${e.evidenceId}: ${e.quote}`),
          "",
        ]),
        "## Angles",
        "",
        ...research.angles.flatMap(a => [
          `- Unknown: ${a.unknown}`,
          `  Why ask: ${a.whyAsk}`,
          `  Ledger notes: ${a.noteIndexes.join(", ")}`,
        ]),
        "",
        "## Gaps",
        "",
        ...research.gaps.map(g => `- ${g}`),
        "",
        "## Attempts",
        "",
        ...attempts.flatMap(a => [
          `- ${a.attempt}: ${a.question || "Abstained"}`,
          `  Outcome: ${a.rejection ?? "Passed model checks; editorial review still required"}`,
        ]),
      ];
      await writeFile(join(directory, "research.md"), report.join("\n") + "\n", {
        mode: 0o600,
        flag: "wx",
      });
      await writeFile(join(directory, "research.json"), JSON.stringify(research, null, 2), {
        mode: 0o600,
        flag: "wx",
      });
    }
    if (!result.preparation) continue;
    const p = result.preparation;
    const dossier = [
      `# ${corpus.artist.name}: preparation`,
      "",
      `Assignment: ${p.purpose}`,
      "",
      "Private experimental output. Notes are interpretations; originals remain authoritative.",
      "",
      `Reading coverage: ${p.memoryDocuments.length} Lore documents; ${p.memoryDocuments.reduce((n, d) => n + d.characters, 0)} extracted characters. This measures submitted text, not comprehension or completeness of PDF extraction.`,
      `Opened for this assignment: ${p.context.length} original records/windows. Omitted source IDs: ${p.omittedIds.length}. Withheld replay source IDs: ${p.withheldIds.length}. See prepared.json for the exact audit.`,
      "",
      "## Already explained",
      "",
      ...p.dossier.alreadyExplained.map(a => `- ${a.observation}`),
      "",
      "## Angles",
      "",
      ...p.dossier.angles.flatMap(a => [
        `### ${a.observation}`,
        "",
        `Unknown: ${a.unknown}`,
        `Why ask: ${a.whyAsk}`,
        `Avoid assuming: ${a.assumptionsToAvoid.join("; ") || "No additional assumption recorded"}`,
        "",
        ...a.evidence.map(e => `- ${e.evidenceId}: ${e.quote}`),
        "",
      ]),
      "## Discarded",
      "",
      ...p.dossier.discarded.map(d => `- ${d}`),
      "",
      "## Research gaps",
      "",
      ...p.dossier.gaps.map(g => `- ${g}`),
    ];
    await writeFile(join(directory, "preparation.md"), dossier.join("\n") + "\n", {
      mode: 0o600,
      flag: "wx",
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
