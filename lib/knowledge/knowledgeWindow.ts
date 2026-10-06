import { KnowledgeError } from "@/lib/knowledge/KnowledgeError";

/** Exact UTF-16 window; widen the start and shorten the end to preserve pairs. */
export function knowledgeWindow(text: string, start: number, maxChars: number) {
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    start > text.length ||
    !Number.isSafeInteger(maxChars) ||
    maxChars < 1
  )
    throw new KnowledgeError("invalid_input", 400, "Invalid text window");
  const splitsPair = (offset: number) =>
    offset > 0 &&
    offset < text.length &&
    /[\uD800-\uDBFF]/.test(text[offset - 1]) &&
    /[\uDC00-\uDFFF]/.test(text[offset]);
  if (splitsPair(start)) start--;
  let end = Math.min(text.length, start + maxChars);
  if (splitsPair(end)) end--;
  return { text: text.slice(start, end), start, end };
}
