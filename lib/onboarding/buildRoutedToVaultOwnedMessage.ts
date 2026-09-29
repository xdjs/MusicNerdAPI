import { formatFailedLinkList } from "@/lib/onboarding/formatFailedLinkList";
import { pluralize } from "@/lib/text/pluralize";

/**
 * A pasted link that isn't a platform profile, whose page title carries the
 * artist's name: added to the vault as approved. Only this case may say "your site".
 *
 * @param urls - The links.
 * @returns The chat line.
 */
export function buildRoutedToVaultOwnedMessage(urls: string[]): string {
  const list = formatFailedLinkList(urls);
  const subject = pluralize(
    urls.length,
    "That's not a platform profile",
    "Those aren't platform profiles",
  );
  const rest = pluralize(urls.length, "it looks like your site", "they look like your own sites");
  const pronoun = pluralize(urls.length, "it", "them");
  const noun = pluralize(urls.length, "a source", "sources");
  return `${subject}: ${list} — but ${rest}, so I've added ${pronoun} as ${noun} for your About.`;
}
