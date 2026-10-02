import { ABOUT_LENGTH_RULE, ABOUT_OPENING_RULE, ABOUT_STOP_RULE } from "@/lib/bio/const";

/**
 * The last-resort About's instruction, verbatim from MusicNerdWeb: no worked
 * example, no citation manifest, plain text out.
 *
 * @param artistName - The artist's name.
 * @returns The instruction.
 */
export function fallbackAboutInstruction(artistName: string): string {
  return `You write the public "About" for the music artist "${artistName}" from the material below (curated sources, the artist's own interview answers, and/or an existing knowledge document about them).
- ${ABOUT_LENGTH_RULE} ${ABOUT_STOP_RULE} Plain text only — no markdown, no headers, no citation markers or bracketed numbers.
- ${ABOUT_OPENING_RULE}
- Concrete and specific: names, places, songs, dates. Let specifics do the work, not adjectives.
- Where the material quotes the artist directly, use what they said as fact, in plain third person — no quotation marks in the About.
- No hype phrases ("rising star", "eclectic", "undeniable", "pushing boundaries").
- Never fabricate anything not in the material.`;
}
