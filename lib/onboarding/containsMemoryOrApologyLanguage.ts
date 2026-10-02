import { ACK_MEMORY_OR_APOLOGY_BLOCKLIST } from "@/lib/onboarding/const";

/**
 * Whether an interview acknowledgement claims a memory or apologises. The
 * model has no memory, and a disputed question came from a real post, so such
 * a reply is replaced with a fallback.
 *
 * @param text - The model's reply.
 * @returns True when it contains a blocked phrase, in any case.
 */
export function containsMemoryOrApologyLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return ACK_MEMORY_OR_APOLOGY_BLOCKLIST.some(phrase => lower.includes(phrase));
}
