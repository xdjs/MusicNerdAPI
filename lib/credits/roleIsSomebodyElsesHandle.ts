import { foldName } from "@/lib/text/foldName";

/**
 * Is this "role" actually somebody else's @handle from the same sentence?
 *
 * The extractor reads co-presence as employment: "my very first @breath.church
 * with @sage.breath and @zavodskyalan" gave all three the role "breath church".
 * A genuine role never contains another handle, because a job is not a
 * username. Measured over Pete Rango's 672 stored credits: 11 rejected, all wrong.
 *
 * Exact equality with the subject's own handle, not containment: containment
 * would let subject "Cole" exempt an unrelated @davidcole, and across all 714
 * stored rows it rescued nothing. The known cost: a bare-name subject whose own
 * handle is in the role is rejected.
 *
 * @param role - The role as extracted.
 * @param subject - Who it was given to.
 * @param quote - The sentence it came from.
 * @returns The offending handle, or null.
 */
export function roleIsSomebodyElsesHandle(
  role: string,
  subject: string,
  quote: string,
): string | null {
  const foldedRole = foldName(role ?? "");
  if (!foldedRole) return null;
  const foldedSubject = foldName(subject ?? "");
  for (const [, handle] of quote.matchAll(/@([A-Za-z0-9._]{4,})/g)) {
    const foldedHandle = foldName(handle);
    // Short handles fold into ordinary words; only the subject's own handle
    // legitimately appears in a role ("feat @someone").
    if (foldedHandle.length < 4 || foldedHandle === foldedSubject) continue;
    if (foldedRole.includes(foldedHandle)) return handle;
  }
  return null;
}
