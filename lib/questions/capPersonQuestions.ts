import { ABOUT_A_PERSON } from "@/lib/questions/const";

/**
 * At most half a set (rounded up) may be about somebody else, or the interview
 * becomes a tour of the artist's contacts. Only enforced while something else
 * is available: an artist whose material really is all collaborators gets a
 * full set about them.
 *
 * @param items - Questions, best first.
 * @param max - The set size.
 * @returns The items, dropping person questions past the cap.
 */
export function capPersonQuestions<T extends { kind: string }>(items: T[], max: number): T[] {
  const allowed = Math.max(1, Math.ceil(max / 2));
  if (!items.some(x => !ABOUT_A_PERSON.has(x.kind))) return items;
  const kept: T[] = [];
  let people = 0;
  for (const item of items) {
    if (ABOUT_A_PERSON.has(item.kind)) {
      if (people >= allowed) continue;
      people++;
    }
    kept.push(item);
  }
  return kept;
}
