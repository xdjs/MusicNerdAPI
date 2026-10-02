/**
 * Why a question reads like a template rather than a person, or null. These
 * are rules the prompt states and the model breaks anyway, so they are checked
 * in code: counting posts, asking the artist to supply the specificity, essay
 * abstractions, prose too long to say aloud, and "what was it like".
 *
 * @param question - A drafted question.
 * @returns The reason, or null if it is fine.
 */
export function boilerplateReason(question: string): string | null {
  if (
    /\b(?:across|over|on|in|through)\s+(?:\d+|many|multiple|several|numerous)\s+(?:posts?|captions?|times?)\b/i.test(
      question,
    ) ||
    /\b\d+\s+(?:posts?|captions?)\b/i.test(question)
  ) {
    return "counts how often something appears";
  }
  if (
    /\b(?:a|one|any|some)\s+(?:specific|particular)\s+(?:moment|detail|example|instance|thing|time|challenge|decision|project|track|memory)\b/i.test(
      question,
    ) ||
    /\bwhat(?:'s| is| was)\s+(?:a|one)\s+(?:specific|particular)\b/i.test(question)
  ) {
    return "asks the artist to supply the specificity";
  }
  if (
    /\b(?:process|approach|practice|identity|dynamic|journey|aspect|element|experience|impact|vision|creative process|body of work)\b/i.test(
      question,
    )
  ) {
    return "uses essay-register abstractions";
  }
  if (question.trim().split(/\s+/).length > 30) return "too long to be spoken";
  if (/\bwhat (?:was|is|were|are)\b[^?]{0,40}\blike\b/i.test(question)) {
    return "asks what something was like";
  }
  return null;
}
