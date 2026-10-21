import { LINK_FIELDS } from "@/lib/artistSearch/const";

/**
 * How much content an artist has: the number of link fields that are set.
 *
 * @param artist - The search row.
 * @returns The count.
 */
export function getLinkCount(artist: Record<string, unknown>): number {
  return LINK_FIELDS.reduce((count, field) => {
    const val = artist[field];
    return count + (val !== null && val !== undefined && val !== "" ? 1 : 0);
  }, 0);
}
