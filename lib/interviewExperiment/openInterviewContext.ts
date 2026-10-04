import { selectInterviewEvidence } from "./selectInterviewEvidence";
import type { EvidenceQuote, InterviewCorpus, InterviewEvidence } from "./types";

/** Open whole captions or contiguous source neighborhoods, retaining offsets and omitted IDs.
 * @param corpus - Originals, after any replay source withholding.
 * @param requested - Ordered exact source references; notes are only navigation.
 * @param asOf - Assignment cutoff.
 * @param budget - JSON byte ceiling; pinned answers and corrections fail rather than disappear.
 * @returns Selected originals and the sources not represented in this packet.
 */
export function openInterviewContext(
  corpus: InterviewCorpus,
  requested: EvidenceQuote[],
  asOf = corpus.capturedAt,
  budget = 48000,
): { evidence: InterviewEvidence[]; omittedIds: string[] } {
  const all = selectInterviewEvidence(corpus.evidence, asOf, Number.MAX_SAFE_INTEGER);
  const opened: InterviewEvidence[] = all.filter(
    e => e.kind === "correction" || e.kind === "answer",
  );
  for (const ref of requested) {
    const source = all.find(e => e.id === ref.evidenceId);
    if (!source || !source.text.includes(ref.quote)) continue;
    if (source.kind !== "lore" || source.text.length <= 12000) {
      opened.push(source);
      continue;
    }
    const anchor = source.text.indexOf(ref.quote);
    let start = Math.max(0, anchor - 3000),
      end = Math.min(source.text.length, anchor + ref.quote.length + 5000);
    const paragraph = source.text.lastIndexOf("\n", start);
    if (paragraph >= Math.max(0, start - 1000)) start = paragraph + 1;
    const boundary = source.text.indexOf("\n", end);
    if (boundary !== -1 && boundary < end + 1000) end = boundary + 1;
    if (/[\uDC00-\uDFFF]/.test(source.text[start])) start--;
    if (/[\uD800-\uDBFF]/.test(source.text[end - 1])) end++;
    opened.push({
      ...source,
      id: `${source.id}@${start}:${end}`,
      text: source.text.slice(start, end),
      range: { sourceId: source.id, start, end, totalChars: source.text.length },
    });
  }
  const evidence = selectInterviewEvidence(opened, asOf, budget);
  const represented = new Set(evidence.map(e => e.range?.sourceId ?? e.id));
  return { evidence, omittedIds: all.filter(e => !represented.has(e.id)).map(e => e.id) };
}
