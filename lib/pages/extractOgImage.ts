import { decodeEntities } from "@/lib/pages/decodeEntities";

/**
 * The page's `og:image`, in either attribute order. Entities are decoded
 * before the scheme check, because serializers escape `&` in attribute values
 * and a signed CDN URL would otherwise come back broken.
 *
 * @param html - The page's HTML.
 * @returns The image URL, only when it is https; otherwise null.
 */
export function extractOgImage(html: string): string | null {
  const match =
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (match?.[1]) {
    const imgUrl = decodeEntities(match[1].trim());
    if (imgUrl.startsWith("https://")) return imgUrl;
  }
  return null;
}
