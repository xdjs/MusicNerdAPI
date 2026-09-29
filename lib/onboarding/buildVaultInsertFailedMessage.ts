import { formatFailedLinkList } from "@/lib/onboarding/formatFailedLinkList";
import { pluralize } from "@/lib/text/pluralize";

/**
 * A pasted link that resolved to a real page but whose vault insert failed.
 *
 * @param urls - The links.
 * @returns The chat line.
 */
export function buildVaultInsertFailedMessage(urls: string[]): string {
  const list = formatFailedLinkList(urls);
  const noun = pluralize(urls.length, "one of your links", `${urls.length} of your links`);
  const pronoun = pluralize(urls.length, "it", "them");
  const sourceNoun = pluralize(urls.length, "a source", "sources");
  return `Heads up — I couldn't save ${noun} as ${sourceNoun} for your About: ${list}. Try again in a moment, or add ${pronoun} later from your Lore.`;
}
