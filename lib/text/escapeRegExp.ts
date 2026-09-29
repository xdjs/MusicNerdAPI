/**
 * Escapes text so it matches literally inside a regular expression.
 *
 * @param text - Any text.
 * @returns The text with every regex metacharacter backslash-escaped.
 */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
