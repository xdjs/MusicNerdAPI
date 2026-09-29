import { foldForMatch } from "@/lib/sources/foldForMatch";

/**
 * Whether text names the artist: the full name, or else its most distinctive
 * token (four or more letters). The token fallback is for pages we already
 * believe are theirs, such as an own site with a wordmark; search results pass
 * `requireFullName`, since "Black Dave"'s token "black" matches much of the web.
 *
 * @param text - The page text.
 * @param artistName - The artist's name.
 * @param opts - Options.
 * @param opts.requireFullName - Accept only the full name.
 * @returns True when the name appears.
 */
export function nameAppearsIn(
  text: string,
  artistName: string,
  opts?: { requireFullName?: boolean },
): boolean {
  const haystack = foldForMatch(text);
  const name = foldForMatch(artistName);
  if (!name) return false;
  if (haystack.includes(name)) return true;
  if (opts?.requireFullName) return false;
  const distinctive = name
    .split(" ")
    .filter(t => t.length >= 4)
    .sort((a, b) => b.length - a.length)[0];
  return distinctive ? haystack.includes(distinctive) : false;
}
