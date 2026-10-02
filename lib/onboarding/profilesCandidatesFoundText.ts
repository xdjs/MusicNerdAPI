import { pluralize } from "@/lib/text/pluralize";

/**
 * The profiles-step line for profiles discovery found and already added.
 *
 * @param count - How many were found.
 * @returns The chat line.
 */
export function profilesCandidatesFoundText(count: number): string {
  return `I also found ${count} more ${pluralize(count, "profile", "profiles")} by searching the web and added ${pluralize(count, "it", "them")} below — remove anything that isn't you.`;
}
