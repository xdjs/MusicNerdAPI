import { RESERVED_HANDLES } from "@/lib/artists/const";
import { normalizeHandle } from "@/lib/instagram/normalizeHandle";

/**
 * Is this "handle" a platform route rather than someone's account? A one-
 * character id counts as reserved on any platform: it is far more likely a
 * truncated path than a real name.
 *
 * @param siteName - The platform.
 * @param id - The resolved handle.
 * @returns True when the id must not be written as a handle.
 */
export function isReservedHandle(siteName: string, id: string): boolean {
  const handle = normalizeHandle(id);
  if (!handle || handle.length < 2) return true;
  return RESERVED_HANDLES[siteName.toLowerCase()]?.has(handle) ?? false;
}
