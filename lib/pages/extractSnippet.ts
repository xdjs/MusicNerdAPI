import { decodeEntities } from "@/lib/pages/decodeEntities";

/**
 * The page's description: the meta description, else `og:description`, in either attribute order.
 *
 * @param html - The page's HTML.
 * @returns The decoded description, or undefined.
 */
export function extractSnippet(html: string): string | undefined {
  const desc =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (desc?.[1]) return decodeEntities(desc[1].trim());
  const og =
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  return og?.[1] ? decodeEntities(og[1].trim()) : undefined;
}
