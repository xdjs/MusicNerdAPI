import type { ValidatedPlatform } from "@/lib/validateLink/const";

/**
 * Fetches a profile page and decides whether it exists: a 404, SoundCloud's
 * redirect to `/404`, or one of the platform's not-found phrases in a 200 page
 * means it doesn't. Any other answer counts as valid.
 *
 * @param url - The profile URL.
 * @param platform - The platform it matched.
 * @returns `{ valid: true }`, or `{ valid: false, reason }`.
 */
export async function checkLinkPage(
  url: string,
  platform: ValidatedPlatform,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  try {
    const response = await fetch(url, { method: "GET" });
    const text = await response.text();
    if (response.status === 404) return { valid: false, reason: "404 Not Found" };
    if (response.status === 200) {
      if (platform.name === "soundcloud" && response.url.includes("/404"))
        return { valid: false, reason: "soundcloud 404 redirect" };
      const page = text.toLowerCase();
      if (platform.errorPhrases.some(phrase => page.includes(phrase.toLowerCase())))
        return { valid: false, reason: `${platform.name} error page` };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "Network error or invalid URL" };
  }
}
