/**
 * Whether extracted page text is a bot gate ("Just a moment…", "verify you are human") rather than
 * the page itself. A challenge page is content from the gate, never artist evidence.
 *
 * @param text - The extracted text.
 * @returns True for a short page that reads like a challenge.
 */
export function isChallengeText(text: string): boolean {
  return (
    /just a moment|verify (?:you are human|your browser)|checking your browser|enable javascript and cookies|access denied/i.test(
      text.slice(0, 2000),
    ) && text.length < 5000
  );
}
