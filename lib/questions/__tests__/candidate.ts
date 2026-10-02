import type { EligibleDraft, SignalCandidate } from "@/lib/questions/types";

/**
 * A signal candidate for tests.
 *
 * @param signalId - The id, also used for the key.
 * @param kind - The kind.
 * @returns A full SignalCandidate.
 */
export function candidate(
  signalId: string,
  kind: SignalCandidate["kind"] = "statement",
): SignalCandidate {
  return {
    signalId,
    kind,
    key: `social_${signalId}`,
    authoredBy: "artist",
    material: `material for ${signalId}`,
    sourceUrls: [`https://www.instagram.com/p/${signalId}/`],
  };
}

/**
 * A resolved answer for tests.
 *
 * @param signalId - The signal it answers.
 * @param kind - The signal's kind.
 * @param boilerplate - Why it is boilerplate, if it is.
 * @returns An EligibleDraft.
 */
export function eligible(
  signalId: string,
  kind: SignalCandidate["kind"] = "statement",
  boilerplate: string | null = null,
): EligibleDraft {
  return {
    candidate: candidate(signalId, kind),
    question: `Q ${signalId}?`,
    rationale: "r",
    boilerplate,
  };
}
