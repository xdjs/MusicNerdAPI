import { decodeEntities } from "@/lib/pages/decodeEntities";

/**
 * The page's `og:title`, in either attribute order.
 *
 * @param html - The page's HTML.
 * @returns The decoded title, or null.
 */
export function extractOgTitle(html: string): string | null {
  const match =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  return match?.[1] ? decodeEntities(match[1].trim()) : null;
}
