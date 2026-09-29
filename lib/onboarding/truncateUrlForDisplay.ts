import { FAILURE_URL_DISPLAY_MAX } from "@/lib/onboarding/const";

/**
 * A long URL cut down for inline chat copy.
 *
 * @param url - The URL.
 * @returns The URL, or its first 47 characters and an ellipsis.
 */
export function truncateUrlForDisplay(url: string): string {
  return url.length > FAILURE_URL_DISPLAY_MAX
    ? `${url.slice(0, FAILURE_URL_DISPLAY_MAX - 1)}…`
    : url;
}
