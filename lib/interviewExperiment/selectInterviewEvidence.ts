import type { InterviewEvidence } from "@/lib/interviewExperiment/types";

/** Select whole evidence records within a UTF-8 byte ceiling; never silently drop memory.
 * @param items - Ordered evidence, higher priority first.
 * @param asOf - Latest permitted publication and availability time.
 * @param maxBytes - Conservative token upper-bound proxy, including JSON metadata.
 * @returns Unique eligible records, corrections and answers first.
 */
export function selectInterviewEvidence(
  items: InterviewEvidence[],
  asOf: string,
  maxBytes: number,
): InterviewEvidence[] {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff) || !Number.isInteger(maxBytes) || maxBytes < 2)
    throw new Error("Invalid context budget or cutoff");
  const unique = new Map<string, InterviewEvidence>();
  for (const item of items) {
    if (
      Date.parse(item.availableAt) <= cutoff &&
      (!item.publishedAt || Date.parse(item.publishedAt) <= cutoff) &&
      item.text.trim() &&
      !unique.has(item.id)
    )
      unique.set(item.id, item);
  }
  const all = [...unique.values()];
  const selected = all
    .filter(e => e.kind === "correction")
    .concat(all.filter(e => e.kind === "answer"));
  if (Buffer.byteLength(JSON.stringify(selected), "utf8") > maxBytes)
    throw new Error("Interview memory exceeds context budget; narrow the assignment explicitly");
  for (const item of all) {
    if (item.kind === "correction" || item.kind === "answer") continue;
    if (Buffer.byteLength(JSON.stringify([...selected, item]), "utf8") <= maxBytes)
      selected.push(item);
  }
  return selected;
}
