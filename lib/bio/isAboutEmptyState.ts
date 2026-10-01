import { ABOUT_EMPTY_STATE } from "@/lib/bio/const";

/**
 * Whether a bio is the claim nudge rather than an About.
 *
 * @param bio - The bio.
 * @returns True for the nudge, ignoring surrounding whitespace.
 */
export function isAboutEmptyState(bio: string | null | undefined): boolean {
  return bio?.trim() === ABOUT_EMPTY_STATE;
}
