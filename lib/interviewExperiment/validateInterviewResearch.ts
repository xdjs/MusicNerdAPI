import { buildInterviewArchive } from "./buildInterviewArchive";
import { locateInterviewQuote } from "./locateInterviewQuote";
import { RESEARCH_FILE_SCHEMA } from "./groundedConst";
import type { InterviewCorpus, InterviewResearch } from "./types";

/** Reject stale or unverifiable preparation before it can become an interview's memory.
 * @param corpus - Current original snapshot.
 * @param value - Untrusted saved preparation JSON.
 * @param options - Exact assignment, cutoff and optional replay withholding.
 * @returns Validated research; semantic claims remain subject to full-archive question review.
 */
export function validateInterviewResearch(
  corpus: InterviewCorpus,
  value: unknown,
  options: { purpose: string; asOf?: string; conversation?: unknown },
): InterviewResearch {
  const research = RESEARCH_FILE_SCHEMA.parse(value);
  const archive = buildInterviewArchive(corpus, options);
  if (
    research.artistId !== corpus.artist.id ||
    research.corpusHash !== archive.corpusHash ||
    research.asOf !== archive.asOf
  )
    throw new Error("Stale research: artist, corpus, cutoff or withheld sources changed");
  if (research.purpose !== options.purpose) throw new Error("Research assignment changed");
  if (
    JSON.stringify(research.sourceIds) !== JSON.stringify(archive.evidence.map(e => e.id)) ||
    research.characters !== archive.evidence.reduce((n, e) => n + e.text.length, 0)
  )
    throw new Error("Research coverage does not match the complete archive");
  if (
    research.notes.length > 24 ||
    research.angles.length > 3 ||
    research.gaps.length > 10 ||
    Buffer.byteLength(JSON.stringify(research.notes)) > 45000
  )
    throw new Error("Research exceeds the bounded ledger budget");
  for (const n of research.notes) {
    if ((!n.evidence.length && n.status !== "unknown") || n.evidence.length > 8)
      throw new Error("Research note requires bounded original citations");
    for (const ref of n.evidence) {
      const source = archive.evidence.find(e => e.id === ref.evidenceId);
      if (!source || !locateInterviewQuote(source.text, ref.quote))
        throw new Error("Invalid research citation");
    }
  }
  for (const angle of research.angles) {
    if (
      !angle.unknown.trim() ||
      !angle.noteIndexes.length ||
      angle.noteIndexes.length > 8 ||
      angle.noteIndexes.some(i => !research.notes[i]) ||
      !angle.noteIndexes.some(i =>
        ["supported", "already-answered"].includes(research.notes[i].status),
      )
    )
      throw new Error("Research angle lacks supported note references");
  }
  return research;
}
