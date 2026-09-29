/**
 * A handle without its leading "@".
 *
 * @param handle - A handle, maybe "@"-prefixed.
 * @returns The handle without one leading "@".
 */
export function withoutAt(handle: string): string {
  return handle.startsWith("@") ? handle.substring(1) : handle;
}
