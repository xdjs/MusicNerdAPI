/**
 * The part of a stored link value that identifies the profile. Usually the
 * value itself, since these columns hold handles. When one holds a whole url,
 * it's the longest path segment: a Facebook profile stored as
 * ".../people/Angela-Bofill/100044180243805/" and "profile.php?id=100044180243805"
 * only have the number in common.
 *
 * @param value - A stored link value.
 * @returns The identifying part, lowercased and without an "@".
 */
export function identifyingPart(value: string): string {
  const v = value.trim().toLowerCase().replace(/^@/, "");
  if (!/^https?:\/\//.test(v)) return v;
  const segments = v.split(/[?#]/)[0].split("/").filter(Boolean).slice(2);
  return segments.sort((a, b) => b.length - a.length)[0] ?? v;
}
