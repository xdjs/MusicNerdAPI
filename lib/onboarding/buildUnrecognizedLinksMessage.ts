import { formatFailedLinkList } from "@/lib/onboarding/formatFailedLinkList";
import { pluralize } from "@/lib/text/pluralize";

/**
 * A pasted link we couldn't read as a profile and that didn't resolve to a
 * real page either. The close matches what happens next: `blocked` means the
 * step is re-shown, so it invites another paste.
 *
 * @param urls - The links.
 * @param blocked - The profiles step is being re-shown rather than confirmed.
 * @returns The chat line.
 */
export function buildUnrecognizedLinksMessage(urls: string[], blocked: boolean): string {
  const list = formatFailedLinkList(urls);
  const noun = pluralize(urls.length, "one of your links", `${urls.length} of your links`);
  const subject = urls.length === 1 ? "It" : "They";
  const verb = pluralize(urls.length, "doesn't", "don't");
  const linkNoun = pluralize(urls.length, "a direct profile link", "direct profile links");
  const tail = blocked
    ? "paste the profile URL and I'll try again."
    : `if it's on a platform we support, you can add ${pluralize(urls.length, "it", "them")} anytime from the Links section of your page.`;
  return `Heads up — I couldn't recognize ${noun}: ${list}. ${subject} ${verb} look like ${linkNoun} (no username or handle at the end) — ${tail}`;
}
