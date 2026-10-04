import { createHash } from "node:crypto";
import { chunkInterviewEvidence } from "./chunkInterviewEvidence";
import { selectInterviewEvidence } from "./selectInterviewEvidence";
import type { InterviewCorpus, InterviewMemory } from "./types";

/** Reject stale, incomplete or corrupted private memory before it can guide an interview.
 * @param corpus - Exact frozen input to the reading phase.
 * @param memory - Saved reading output; never an authority for facts.
 * @param asOf - Assignment cutoff; memory from a different cutoff must be rebuilt.
 * @param allowPartial - Permit only a verified prefix when resuming a failed reading.
 * @returns Nothing on success; throws for invalid provenance or coverage.
 */
export function validateInterviewMemory(
  corpus: InterviewCorpus,
  memory: InterviewMemory,
  asOf: string,
  allowPartial = false,
): void {
  if (
    memory.version !== 1 ||
    memory.promptVersion !== "reading-v1" ||
    memory.artistId !== corpus.artist.id ||
    memory.asOf !== asOf ||
    memory.corpusHash !== createHash("sha256").update(JSON.stringify(corpus)).digest("hex")
  )
    throw new Error("Stale or mismatched interview memory; rebuild the index");
  const sources = selectInterviewEvidence(
    corpus.evidence.filter(e => e.kind === "lore"),
    asOf,
    Number.MAX_SAFE_INTEGER,
  );
  if (
    JSON.stringify(memory.documents) !==
    JSON.stringify(sources.map(e => ({ sourceId: e.id, characters: e.text.length })))
  )
    throw new Error("Memory document coverage mismatch");
  const expected = sources.flatMap(source =>
    chunkInterviewEvidence([source], 16000).map(section => ({ source, section })),
  );
  if (
    allowPartial
      ? memory.sections.length > expected.length
      : expected.length !== memory.sections.length
  )
    throw new Error("Incomplete reading coverage");
  for (const [i, { source, section }] of expected.entries()) {
    if (allowPartial && i >= memory.sections.length) break;
    const saved = memory.sections[i];
    const start = section.id === source.id ? 0 : Number(section.id.slice(source.id.length + 1));
    if (
      saved.sourceId !== source.id ||
      saved.start !== start ||
      saved.end !== start + section.text.length
    )
      throw new Error("Invalid reading section range");
    for (const note of saved.notes)
      if (note.quote.trim().length < 12 || !section.text.includes(note.quote))
        throw new Error("Invalid memory quote");
  }
}
