import { formatFailedLinkList } from "@/lib/onboarding/formatFailedLinkList";
import { pluralize } from "@/lib/text/pluralize";

/**
 * A pasted link that isn't a platform profile, whose title didn't carry the
 * artist's name: added as pending, for the vault step to confirm.
 *
 * @param urls - The links.
 * @returns The chat line.
 */
export function buildRoutedToVaultPendingMessage(urls: string[]): string {
  const list = formatFailedLinkList(urls);
  const subject = pluralize(
    urls.length,
    "That's not a platform profile",
    "Those aren't platform profiles",
  );
  const pronoun = pluralize(urls.length, "it", "them");
  const noun = pluralize(urls.length, "a possible source", "possible sources");
  const verb = pluralize(urls.length, "it's", "they're");
  return `${subject}: ${list} — I've added ${pronoun} as ${noun} for your About; you'll get to confirm ${verb} accurate in a moment.`;
}
