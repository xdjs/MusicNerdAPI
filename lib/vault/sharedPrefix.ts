import { foldName } from "@/lib/text/foldName";

/**
 * Length of the common opening run of a handle and a name, both folded. A
 * prefix, not a substring: a handle that merely contains a common word is no
 * evidence, one that starts the same way is.
 *
 * @param handle - The handle.
 * @param artistName - The artist's name.
 * @returns The number of leading characters they share.
 */
export function sharedPrefix(handle: string, artistName: string): number {
  const a = foldName(handle);
  const b = foldName(artistName);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
