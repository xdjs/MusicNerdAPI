/**
 * Compares a DISPLAY NAME against a HANDLE, which `normalizeHandle` cannot:
 * it keeps spaces and punctuation, so "Pharaoh Sistare" never equals
 * "pharaohsistare". Deliberately lossy; compare handle to handle with
 * `normalizeHandle`.
 *
 * @param value - A display name or handle.
 * @returns Lowercase letters and digits only.
 */
export function normalizeLoose(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]/g, "");
}
