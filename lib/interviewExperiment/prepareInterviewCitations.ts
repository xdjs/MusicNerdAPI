import type { EvidenceQuote, InterviewEvidence } from "./types";

/** Label contiguous original text so the model selects citations instead of rewriting quotes.
 * @param evidence - Full source windows already selected for the assignment.
 * @returns Lossless labelled sources and an exact reference lookup for output restoration.
 */
export function prepareInterviewCitations(evidence: InterviewEvidence[]): {
  sources: (Omit<InterviewEvidence, "text"> & { passages: { ref: string; text: string }[] })[];
  references: Record<string, EvidenceQuote>;
} {
  const references: Record<string, EvidenceQuote> = {};
  let sequence = 0;
  const sources = evidence.map(({ text, ...source }) => {
    const passages: { ref: string; text: string }[] = [];
    for (let start = 0; start < text.length;) {
      let end = Math.min(start + 400, text.length);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));
        if (boundary > start + 200) end = boundary + 1;
        if (text.length - end < 12) end = text.length;
        if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      }
      const ref = `c${++sequence}`,
        quote = text.slice(start, end);
      passages.push({ ref, text: quote });
      references[ref] = { evidenceId: source.id, quote };
      start = end;
    }
    return { ...source, passages };
  });
  return { sources, references };
}
