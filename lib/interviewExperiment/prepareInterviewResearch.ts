import { buildInterviewArchive } from "./buildInterviewArchive";
import { callInterviewModel } from "./callInterviewModel";
import { validateInterviewResearch } from "./validateInterviewResearch";
import { GROUNDED_MODEL, RESEARCH_INSTRUCTION, RESEARCH_SCHEMA } from "./groundedConst";
import type { InterviewCorpus, InterviewResearch } from "./types";

/** Read complete originals once into a private, version-bound preparation ledger.
 * @param corpus - Frozen archive; no database writes.
 * @param options - Explicit assignment and optional model, cutoff or replay withholding.
 * @returns Reusable preparation with exact original evidence and complete submitted-source coverage.
 */
export async function prepareInterviewResearch(
  corpus: InterviewCorpus,
  options: { purpose: string; model?: string; asOf?: string; conversation?: unknown },
): Promise<InterviewResearch> {
  if (!options.purpose.trim() || options.purpose.length > 2000)
    throw new Error("A purpose of 1–2,000 characters is required");
  const archive = buildInterviewArchive(corpus, options),
    model = options.model ?? GROUNDED_MODEL;
  const result = await callInterviewModel(
    "research",
    RESEARCH_INSTRUCTION,
    {
      artist: corpus.artist.name,
      asOf: archive.asOf,
      purpose: options.purpose,
      evidence: archive.catalog.sources,
      coverage:
        "All eligible original sources supplied. Photos/audio not extracted into text remain unavailable.",
    },
    RESEARCH_SCHEMA,
    model,
    "archive",
  );
  const notes = result.output.notes.map(({ citations, ...note }) => ({
    ...note,
    evidence: citations.map(ref => {
      const original = archive.catalog.references[ref];
      if (!original) throw new Error("Unknown research citation");
      return original;
    }),
  }));
  return validateInterviewResearch(
    corpus,
    {
      version: 1,
      promptVersion: "grounded-v1",
      artistId: corpus.artist.id,
      corpusHash: archive.corpusHash,
      asOf: archive.asOf,
      purpose: options.purpose,
      model,
      sourceIds: archive.evidence.map(e => e.id),
      characters: archive.evidence.reduce((n, e) => n + e.text.length, 0),
      notes,
      angles: result.output.angles,
      gaps: result.output.gaps,
      call: result.call,
    },
    options,
  );
}
