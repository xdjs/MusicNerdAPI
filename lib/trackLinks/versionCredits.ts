import { VERSION_WORDS } from "@/lib/trackLinks/const";
import { normTrackText } from "@/lib/trackLinks/normTrackText";

/**
 * The bracketed version credits in a title, normalised. "crying on the floor
 * (pete rango mix)" has one; "Rango Sessions" has none, which is the point: a
 * name in the body of a title says nothing about who made this recording.
 *
 * @param title - The record's title.
 * @returns The version credits.
 */
export function versionCredits(title: string): string[] {
  return [...title.matchAll(/[([]([^)\]]{1,80})[)\]]/g)]
    .map(m => m[1])
    .filter(seg => VERSION_WORDS.test(seg))
    .map(normTrackText);
}
