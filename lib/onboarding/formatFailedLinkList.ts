import { truncateUrlForDisplay } from "@/lib/onboarding/truncateUrlForDisplay";

/**
 * The failed links, as a comma-separated list for chat copy.
 *
 * @param urls - The links.
 * @returns The list, each link truncated for display.
 */
export function formatFailedLinkList(urls: string[]): string {
  return urls.map(truncateUrlForDisplay).join(", ");
}
