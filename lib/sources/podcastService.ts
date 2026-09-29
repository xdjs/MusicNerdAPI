/**
 * The listening destination for a recognised podcast episode URL.
 *
 * @param url - A URL.
 * @returns "Apple Podcasts" or "iHeart" for an episode URL, else null.
 */
export function podcastService(url: string): "Apple Podcasts" | "iHeart" | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "podcasts.apple.com" && parsed.searchParams.has("i"))
      return "Apple Podcasts";
    if (
      (parsed.hostname === "iheart.com" || parsed.hostname === "www.iheart.com") &&
      parsed.pathname.includes("/episode/")
    )
      return "iHeart";
  } catch {
    // Not a URL.
  }
  return null;
}
