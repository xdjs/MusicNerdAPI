/**
 * A handle in the form handles are compared in: trimmed, lowercase, no "@".
 *
 * @param handle - An Instagram handle.
 * @returns The normalized handle.
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@/, "");
}
