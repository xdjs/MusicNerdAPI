import { PROFILE_UPDATE_KINDS } from "@/lib/profile/const";

/**
 * Whether a Latest card of `kind` belongs under the profile `filter`.
 *
 * @param kind - The card's kind.
 * @param filter - The `kind` query of GET /api/profile/updates.
 * @returns True when the card is kept.
 */
export function matchesProfileUpdateFilter(kind: string, filter: string): boolean {
  return (
    filter === "All" ||
    (Object.hasOwn(PROFILE_UPDATE_KINDS, filter) && PROFILE_UPDATE_KINDS[filter]!.includes(kind))
  );
}
