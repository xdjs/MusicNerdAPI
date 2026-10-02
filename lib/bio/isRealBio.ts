import { isAboutEmptyState } from "@/lib/bio/isAboutEmptyState";

/**
 * Whether a bio is a real About: non-empty and not the claim nudge. The nudge
 * must never be kept in history or fed back as an existing bio.
 *
 * @param bio - The bio.
 * @returns True for a real About.
 */
export function isRealBio(bio: string | null | undefined): boolean {
  return !!bio && bio.trim().length > 0 && !isAboutEmptyState(bio);
}
