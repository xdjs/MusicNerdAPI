/**
 * Escapes text for an HTML email body.
 *
 * @param value - Untrusted text, e.g. an artist name.
 * @returns The text with `&`, `<`, `>`, `"` and `'` escaped.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
