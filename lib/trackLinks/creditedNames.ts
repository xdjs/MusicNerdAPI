import { normTrackText } from "@/lib/trackLinks/normTrackText";

/**
 * The people a provider credits, one per entry. Split on the raw string
 * BEFORE normalising, because normalising removes the "&" that separates
 * them: "Dame Atlas & Pete Rango" is two people, "Dave East" is one.
 *
 * @param credit - The provider's artist credit.
 * @returns The normalised names.
 */
export function creditedNames(credit: string): string[] {
  return credit
    .split(/\s*(?:&|\/|,|\bx\b|\bvs\.?\b|\bfeat\.?\b|\bft\.?\b|\bwith\b|\band\b)\s*/i)
    .map(normTrackText)
    .filter(Boolean);
}
