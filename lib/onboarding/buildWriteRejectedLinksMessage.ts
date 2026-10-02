import { formatFailedLinkList } from "@/lib/onboarding/formatFailedLinkList";
import { pluralize } from "@/lib/text/pluralize";

/**
 * A link we read fine whose write was refused, most likely because it's
 * already linked to another artist. Avoids "recognize", which is a different failure.
 *
 * @param urls - The links.
 * @param blocked - The profiles step is being re-shown rather than confirmed.
 * @returns The chat line.
 */
export function buildWriteRejectedLinksMessage(urls: string[], blocked: boolean): string {
  const list = formatFailedLinkList(urls);
  const noun = pluralize(urls.length, "one of your links", `${urls.length} of your links`);
  const pronoun = pluralize(urls.length, "it's", "they're");
  const tail = blocked
    ? "try a different link, or reach out if that seems wrong."
    : "you can try again anytime from the Links section of your page, or reach out if that seems wrong.";
  return `Heads up — I couldn't save ${noun}: ${list}. Looks like ${pronoun} already linked to another profile on Music Nerd — ${tail}`;
}
