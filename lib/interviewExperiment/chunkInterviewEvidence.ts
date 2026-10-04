import type { InterviewEvidence } from "@/lib/interviewExperiment/types";

/** Expose overlapping original passages from long sources; preserve their source identity.
 * @param items - Complete source records.
 * @param maxChars - Maximum passage size, not a token estimate.
 * @returns Original text slices with stable offsets; memory remains whole.
 */
export function chunkInterviewEvidence(
  items: InterviewEvidence[],
  maxChars = 2800,
): InterviewEvidence[] {
  if (maxChars < 400) throw new Error("Passages must retain surrounding context");
  return items.flatMap(item => {
    if (item.text.length <= maxChars || item.kind === "answer" || item.kind === "correction")
      return [item];
    const chunks: InterviewEvidence[] = [];
    for (let start = 0; start < item.text.length;) {
      let end = Math.min(item.text.length, start + maxChars);
      if (end < item.text.length) {
        const boundary = item.text.lastIndexOf("\n", end);
        if (boundary > start + maxChars / 2) end = boundary + 1;
        if (/[\uD800-\uDBFF]/.test(item.text[end - 1])) end--;
      }
      chunks.push({
        ...item,
        id: `${item.id}#${start}`,
        text: item.text.slice(start, end),
        title: item.text.split("\n")[0].slice(0, 180),
      });
      if (end === item.text.length) break;
      start = end - 160;
    }
    return chunks;
  });
}
