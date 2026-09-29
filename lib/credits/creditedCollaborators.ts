import type { CaptionExtraction, CreditedCollaborator } from "@/lib/credits/types";
import { foldName } from "@/lib/text/foldName";

/**
 * Everyone the artist credited with a role in their own captions, other than
 * themselves, strongest first. A credit says what somebody did, which is
 * better evidence than a coauthor tag, and for an artist who never uses those
 * it is the only evidence there is.
 *
 * A role is "recurring" only when given on more than one post: Pete Rango's
 * "main production partner" across 23 posts is the relationship, "added some
 * 808s" once (files later lost) is not.
 *
 * @param extraction - The stored credits and statements.
 * @returns One entry per person, ranked by how many posts credit them.
 */
export function creditedCollaborators(extraction: CaptionExtraction): CreditedCollaborator[] {
  const by = new Map<string, CreditedCollaborator>();
  // person -> role -> the distinct posts that role was given on.
  const roleUrls = new Map<string, Map<string, Set<string>>>();
  for (const c of extraction.credits) {
    if (c.isSelf) continue; // a fact about them, not an edge
    const key = foldName(c.subject ?? "");
    if (!key) continue;

    const roleKey = c.role.toLowerCase();
    const forPerson = roleUrls.get(key) ?? new Map<string, Set<string>>();
    const urls = forPerson.get(roleKey) ?? new Set<string>();
    urls.add(c.url);
    forPerson.set(roleKey, urls);
    roleUrls.set(key, forPerson);

    const existing = by.get(key);
    if (existing) {
      if (!existing.roles.some(r => r.toLowerCase() === roleKey)) existing.roles.push(c.role);
      if (c.quote && !existing.quotes.includes(c.quote)) existing.quotes.push(c.quote);
      if (!existing.evidenceUrls.includes(c.url)) existing.evidenceUrls.push(c.url);
      // A handle is more useful than a bare name; upgrade if we later see one.
      if (c.isHandle && !existing.isHandle) {
        existing.isHandle = true;
        existing.subject = c.subject;
      }
    } else {
      by.set(key, {
        subject: c.subject,
        isHandle: c.isHandle,
        roles: [c.role],
        recurringRoles: [],
        quotes: c.quote ? [c.quote] : [],
        evidenceUrls: [c.url],
      });
    }
  }
  for (const [key, person] of by) {
    const counts = roleUrls.get(key);
    person.recurringRoles = person.roles.filter(
      r => (counts?.get(r.toLowerCase())?.size ?? 0) >= 2,
    );
  }
  return [...by.values()].sort((a, b) => b.evidenceUrls.length - a.evidenceUrls.length);
}
